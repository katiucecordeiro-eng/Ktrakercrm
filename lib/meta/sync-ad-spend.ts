import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchMetaInsights } from "@/lib/meta/marketing-api";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { Offer } from "@/lib/types/offer";

// Aceita tanto o client com service role (cron) quanto o client
// autenticado do painel (sincronização manual por oferta).
type AnySupabaseClient = SupabaseClient;

export type OfferSyncResult = {
  offer_id: string;
  offer_name: string;
  skipped?: boolean;
  rows?: number;
  error?: string;
};

// Token por oferta (colado no formulário) com fallback para o antigo env
// var global — mantém compatibilidade para quem configurou antes desta
// mudança.
export function resolveMetaAdsToken(offer: Offer): string | null {
  return decryptSecret(offer.meta_ads_token) ?? process.env.META_MARKETING_API_ACCESS_TOKEN ?? null;
}

export async function syncOfferAdSpend(
  supabase: AnySupabaseClient,
  offer: Offer,
  since: string,
  until: string,
): Promise<OfferSyncResult> {
  if (!offer.meta_ad_account_id) {
    return { offer_id: offer.id, offer_name: offer.name, skipped: true };
  }

  const accessToken = resolveMetaAdsToken(offer);
  if (!accessToken) {
    return {
      offer_id: offer.id,
      offer_name: offer.name,
      error: "Token da Marketing API não configurado para esta oferta",
    };
  }

  const { rows, error } = await fetchMetaInsights({
    adAccountId: offer.meta_ad_account_id,
    since,
    until,
    accessToken,
  });

  if (rows.length > 0) {
    const upsertRows = rows
      .filter((row) => row.ad_id)
      .map((row) => ({
        offer_id: offer.id,
        date: row.date,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        adset_id: row.adset_id,
        adset_name: row.adset_name,
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        reach: row.reach,
        frequency: row.frequency,
        cpc: row.clicks > 0 ? row.spend / row.clicks : null,
        cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null,
        synced_at: new Date().toISOString(),
      }));

    if (upsertRows.length > 0) {
      await supabase.from("ad_spend").upsert(upsertRows, { onConflict: "date,ad_id" });
    }
  }

  return { offer_id: offer.id, offer_name: offer.name, rows: rows.length, error };
}

export async function syncAllOffers(
  supabase: AnySupabaseClient,
  since: string,
  until: string,
): Promise<OfferSyncResult[]> {
  const { data: offers } = await supabase.from("offers").select("*").eq("active", true);
  const results: OfferSyncResult[] = [];

  for (const offer of (offers as Offer[] | null) ?? []) {
    results.push(await syncOfferAdSpend(supabase, offer, since, until));
  }

  return results;
}
