import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchMetaInsights } from "@/lib/meta/marketing-api";
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

export async function syncOfferAdSpend(
  supabase: AnySupabaseClient,
  offer: Offer,
  since: string,
  until: string,
): Promise<OfferSyncResult> {
  if (!offer.meta_ad_account_id) {
    return { offer_id: offer.id, offer_name: offer.name, skipped: true };
  }

  const { rows, error } = await fetchMetaInsights({
    adAccountId: offer.meta_ad_account_id,
    since,
    until,
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
