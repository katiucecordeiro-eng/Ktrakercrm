import { NextResponse, after } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hotmartWebhookSchema } from "@/lib/validations/hotmart";
import { sha256 } from "@/lib/crypto/hash";
import { sendMetaEvent } from "@/lib/meta/capi";
import { sendGa4Event } from "@/lib/ga4/measurement-protocol";
import { resolveVisitor } from "@/lib/hotmart/resolve-visitor";
import {
  extractSck,
  extractSrc,
  extractTransactionId,
  extractProductId,
  extractBuyer,
  extractCartAbandonmentLead,
  extractPurchaseValue,
  extractPayment,
  extractIdFromUtm,
  PURCHASE_EVENT_STATUS,
} from "@/lib/hotmart/extract";
import type { Offer } from "@/lib/types/offer";

export const runtime = "nodejs";

type Json = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function logWebhook(
  supabase: SupabaseAdmin | null,
  payload: unknown,
  status: string,
  error?: string,
) {
  if (!supabase) return;
  try {
    await supabase.from("webhook_logs").insert({
      source: "hotmart",
      payload: payload ?? null,
      status,
      error: error ?? null,
    });
  } catch (logError) {
    // O log é auditoria, não pode derrubar o webhook se o banco estiver
    // fora do ar.
    console.error("[api/webhooks/hotmart] falha ao gravar webhook_logs", logError);
  }
}

async function resolveOffer(supabase: SupabaseAdmin, productId: string): Promise<Offer | null> {
  const { data } = await supabase
    .from("offers")
    .select("*")
    .contains("hotmart_product_ids", [productId])
    .maybeSingle();
  return (data as Offer | null) ?? null;
}

async function handlePurchaseEvent(supabase: SupabaseAdmin, data: Json, status: string) {
  const productId = extractProductId(data);
  if (!productId) return;

  const offer = await resolveOffer(supabase, productId);
  if (!offer) return;

  const transactionId = extractTransactionId(data);
  if (!transactionId) return;

  const buyer = extractBuyer(data);
  const sck = extractSck(data);
  const src = extractSrc(data);
  const visitor = await resolveVisitor(supabase, sck, buyer.email);

  const utmCampaign = visitor?.utm_campaign ?? null;
  const utmMedium = visitor?.utm_medium ?? null;
  const utmContent = visitor?.utm_content ?? null;

  const { data: existingSale } = await supabase
    .from("sales")
    .select("id, status")
    .eq("hotmart_transaction_id", transactionId)
    .maybeSingle();

  const wasApproved = existingSale?.status === "approved";
  const { value: grossValue, currency } = extractPurchaseValue(data);
  const payment = extractPayment(data);
  const now = new Date().toISOString();
  const product = data.product as Json | undefined;

  const saleRow: Record<string, unknown> = {
    offer_id: offer.id,
    visitor_id: visitor?.id ?? null,
    hotmart_transaction_id: transactionId,
    product_id: productId,
    product_name: (product?.name as string | undefined) ?? null,
    status,
    payment_method: payment.method,
    installments: payment.installments,
    gross_value: grossValue,
    // net_value depende do detalhamento de comissão da Hotmart
    // (data.commissions) — não estimado aqui para não exibir um valor
    // incorreto no dashboard; fica null até validarmos o payload real.
    net_value: null,
    currency,
    buyer_email_hash: buyer.email ? sha256(buyer.email) : null,
    buyer_name: buyer.name,
    utm_source: visitor?.utm_source ?? src ?? null,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: visitor?.utm_term ?? null,
    campaign_id: extractIdFromUtm(utmCampaign),
    adset_id: extractIdFromUtm(utmMedium),
    ad_id: extractIdFromUtm(utmContent),
    raw_payload: data,
  };

  if (status === "approved") saleRow.approved_at = now;
  if (status === "refunded" || status === "chargeback") saleRow.refunded_at = now;

  await supabase.from("sales").upsert(saleRow, { onConflict: "hotmart_transaction_id" });

  if (status === "approved" && !wasApproved) {
    after(async () => {
      const eventId = `hotmart-${transactionId}`;
      const eventTime = Math.floor(Date.now() / 1000);

      const [metaResult, ga4Result] = await Promise.all([
        sendMetaEvent({
          offer,
          eventName: "Purchase",
          eventId,
          eventTime,
          fbp: visitor?.fbp ?? null,
          fbc: visitor?.fbc ?? null,
          externalId: visitor?.id ?? transactionId,
          email: buyer.email,
          phone: buyer.phone,
          customData: { value: grossValue, currency },
        }),
        sendGa4Event({
          offer,
          eventName: "Purchase",
          clientId: visitor?.ga_client_id || visitor?.id || transactionId,
          params: { value: grossValue, currency, transaction_id: transactionId },
        }),
      ]);

      if (metaResult.status === "failed" || ga4Result.status === "failed") {
        console.error("[api/webhooks/hotmart] falha ao notificar Meta/GA4", {
          transactionId,
          metaResult,
          ga4Result,
        });
      }
    });
  }
}

async function handleCartAbandonment(supabase: SupabaseAdmin, data: Json) {
  const productId = extractProductId(data);
  const offer = productId ? await resolveOffer(supabase, productId) : null;
  if (!offer) return;

  const lead = extractCartAbandonmentLead(data);
  const sck = extractSck(data);
  const visitor = sck
    ? (await supabase.from("visitors").select("id").eq("id", sck).maybeSingle()).data
    : null;

  await supabase.from("leads").insert({
    offer_id: offer.id,
    visitor_id: visitor?.id ?? null,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: "hotmart_cart_abandonment",
  });
}

export async function POST(request: Request) {
  let supabase: SupabaseAdmin | null;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error("[api/webhooks/hotmart] Supabase não configurado", error);
    supabase = null;
  }

  let rawBody: unknown = null;

  try {
    rawBody = await request.json();
  } catch {
    await logWebhook(supabase, null, "invalid_json");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = hotmartWebhookSchema.safeParse(rawBody);
  if (!parsed.success) {
    await logWebhook(supabase, rawBody, "invalid_payload", parsed.error.message);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payload = parsed.data;
  const receivedToken = request.headers.get("hottok") || payload.hottok || null;
  const expectedToken = process.env.HOTMART_HOTTOK;

  if (expectedToken && receivedToken !== expectedToken) {
    await logWebhook(supabase, payload, "invalid_hottok");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 200 });
  }

  try {
    const data = payload.data as Json;

    if (payload.event === "PURCHASE_OUT_OF_SHOPPING_CART") {
      await handleCartAbandonment(supabase, data);
    } else {
      const status = PURCHASE_EVENT_STATUS[payload.event];
      if (status) {
        await handlePurchaseEvent(supabase, data, status);
      } else {
        await logWebhook(supabase, payload, "ignored_event");
        return NextResponse.json({ ok: true });
      }
    }

    await logWebhook(supabase, payload, "processed");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/webhooks/hotmart] erro inesperado", error);
    await logWebhook(
      supabase,
      payload,
      "error",
      error instanceof Error ? error.message : String(error),
    );
    // 200 mesmo em erro interno: evita que a Hotmart fique reentregando o
    // mesmo webhook indefinidamente enquanto o payload já está logado.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
