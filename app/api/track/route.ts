import { NextResponse, after } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { trackEventSchema } from "@/lib/validations/track";
import { isRateLimited } from "@/lib/rate-limit";
import { sendMetaEvent } from "@/lib/meta/capi";
import { sendGa4Event } from "@/lib/ga4/measurement-protocol";
import { resolveCorsOrigin, corsHeaders } from "@/lib/cors";
import type { Offer } from "@/lib/types/offer";

export const runtime = "nodejs";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (ip && isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = trackEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const input = parsed.data;

  let offer: Offer | null = null;
  try {
    const supabase = createAdminClient();

    // ilike (case-insensitive) — evita que um data-offer com maiúscula
    // diferente do slug cadastrado derrube o evento silenciosamente (o
    // beacon do track.js nunca lê a resposta, então um 404 aqui é invisível
    // no navegador).
    const { data: offerRow } = await supabase
      .from("offers")
      .select("*")
      .ilike("slug", input.offer_slug)
      .eq("active", true)
      .maybeSingle();
    offer = offerRow as Offer | null;

    if (!offer) {
      console.warn("[api/track] offer_not_found", { slug: input.offer_slug, ip });
      return NextResponse.json({ ok: false, error: "offer_not_found" }, { status: 404 });
    }

    const origin = request.headers.get("origin");
    const allowedOrigin = resolveCorsOrigin(origin, offer.domain);
    const headers = corsHeaders(allowedOrigin);

    const userAgent = request.headers.get("user-agent");
    const geoCity = request.headers.get("x-vercel-ip-city");
    const geoRegion = request.headers.get("x-vercel-ip-country-region");
    const geoCountry = request.headers.get("x-vercel-ip-country");

    const { data: existingVisitor } = await supabase
      .from("visitors")
      .select("id, fbp, fbc, ga_client_id")
      .eq("id", input.visitor_id)
      .maybeSingle();

    if (!existingVisitor) {
      await supabase.from("visitors").insert({
        id: input.visitor_id,
        offer_id: offer.id,
        utm_source: input.utm_source,
        utm_medium: input.utm_medium,
        utm_campaign: input.utm_campaign,
        utm_content: input.utm_content,
        utm_term: input.utm_term,
        fbclid: input.fbclid,
        fbp: input.fbp,
        fbc: input.fbc,
        ga_client_id: input.ga_client_id,
        referrer: input.referrer,
        landing_page: input.landing_page,
        ip,
        user_agent: userAgent,
        city: geoCity ? decodeURIComponent(geoCity) : null,
        region: geoRegion ? decodeURIComponent(geoRegion) : null,
        country: geoCountry,
        device_type: input.device_type,
      });
    } else {
      const updates: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
      if (!existingVisitor.fbp && input.fbp) updates.fbp = input.fbp;
      if (!existingVisitor.fbc && input.fbc) updates.fbc = input.fbc;
      if (!existingVisitor.ga_client_id && input.ga_client_id) {
        updates.ga_client_id = input.ga_client_id;
      }
      await supabase.from("visitors").update(updates).eq("id", input.visitor_id);
    }

    const { data: insertedEvent } = await supabase
      .from("events")
      .insert({
        visitor_id: input.visitor_id,
        offer_id: offer.id,
        event_name: input.event_name,
        event_id: input.event_id,
        page_url: input.page_url,
        utm_source: input.utm_source,
        utm_medium: input.utm_medium,
        utm_campaign: input.utm_campaign,
        utm_content: input.utm_content,
        utm_term: input.utm_term,
      })
      .select("id")
      .single();

    const eventRowId = insertedEvent?.id as string | undefined;
    const { email, phone, ...customData } = input.custom_data ?? {};

    // Responde rápido ao navegador; Meta CAPI + GA4 são enviados depois,
    // sem atrasar o beacon do track.js.
    after(async () => {
      const eventTime = Math.floor(Date.now() / 1000);

      const [metaResult, ga4Result] = await Promise.all([
        sendMetaEvent({
          offer: offer as Offer,
          eventName: input.event_name,
          eventId: input.event_id,
          eventTime,
          eventSourceUrl: input.page_url,
          clientIpAddress: ip,
          clientUserAgent: userAgent,
          fbp: input.fbp,
          fbc: input.fbc,
          externalId: input.visitor_id,
          email,
          phone,
          customData,
        }),
        sendGa4Event({
          offer: offer as Offer,
          eventName: input.event_name,
          clientId: input.ga_client_id || input.visitor_id,
          params: customData,
        }),
      ]);

      if (eventRowId) {
        await supabase
          .from("events")
          .update({
            meta_status: metaResult.status,
            meta_response: metaResult.response,
            ga4_status: ga4Result.status,
          })
          .eq("id", eventRowId);
      }
    });

    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    console.error("[api/track] erro inesperado", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
