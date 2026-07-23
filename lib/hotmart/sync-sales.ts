import type { SupabaseClient } from "@supabase/supabase-js";

import { sha256 } from "@/lib/crypto/hash";
import { resolveVisitor } from "@/lib/hotmart/resolve-visitor";
import {
  extractApprovedDate,
  extractBuyer,
  extractIdFromUtm,
  extractPayment,
  extractPurchaseValue,
  extractSalesHistoryStatus,
  extractSck,
  extractSrc,
  extractTransactionId,
} from "@/lib/hotmart/extract";
import { fetchAllHotmartSalesForProduct, getHotmartAccessToken } from "@/lib/hotmart/api-client";
import type { Offer } from "@/lib/types/offer";

type Json = Record<string, unknown>;

export type SalesHistorySyncResult = {
  imported: number;
  skipped: number;
  error?: string;
};

// Backfill de vendas retroativas — só grava em `sales`. Nunca dispara
// Purchase pra Meta CAPI/GA4: são vendas antigas, e a Meta rejeita (ou
// penaliza a qualidade do sinal de) eventos com event_time fora da janela
// de poucos dias, além de já termos disparado (ou não) esses eventos na
// época real da venda via webhook.
export async function syncOfferSalesHistory(
  supabase: SupabaseClient,
  offer: Offer,
  since: Date,
  until: Date,
): Promise<SalesHistorySyncResult> {
  if (offer.hotmart_product_ids.length === 0) {
    return { imported: 0, skipped: 0, error: "Cadastre os produtos Hotmart desta oferta primeiro." };
  }

  const { accessToken, error: tokenError } = await getHotmartAccessToken();
  if (!accessToken) {
    return { imported: 0, skipped: 0, error: tokenError ?? "Falha ao autenticar com a Hotmart." };
  }

  let imported = 0;
  let skipped = 0;

  for (const productId of offer.hotmart_product_ids) {
    const { items, error } = await fetchAllHotmartSalesForProduct({
      accessToken,
      productId,
      startDate: since,
      endDate: until,
    });

    if (error) return { imported, skipped, error };

    for (const item of items) {
      const data = item as Json;
      const transactionId = extractTransactionId(data);
      const status = extractSalesHistoryStatus(data);

      if (!transactionId || !status) {
        skipped += 1;
        continue;
      }

      const buyer = extractBuyer(data);
      const sck = extractSck(data);
      const src = extractSrc(data);
      const visitor = await resolveVisitor(supabase, sck, buyer.email);

      const utmCampaign = visitor?.utm_campaign ?? null;
      const utmMedium = visitor?.utm_medium ?? null;
      const utmContent = visitor?.utm_content ?? null;

      const { value: grossValue, currency } = extractPurchaseValue(data);
      const payment = extractPayment(data);
      const product = data.product as Json | undefined;
      const approvedAt = extractApprovedDate(data);

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

      if (status === "approved") saleRow.approved_at = approvedAt;
      if (status === "refunded" || status === "chargeback") saleRow.refunded_at = approvedAt;

      const { error: upsertError } = await supabase
        .from("sales")
        .upsert(saleRow, { onConflict: "hotmart_transaction_id" });

      if (upsertError) {
        skipped += 1;
      } else {
        imported += 1;
      }
    }
  }

  return { imported, skipped };
}
