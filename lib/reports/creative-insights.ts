import type { SupabaseClient } from "@supabase/supabase-js";

import { computeAdMetrics } from "./queries";
import { getPreviousPeriodFilters } from "./filters";
import type { ReportFilters } from "./types";
import { resolveMetaAdsToken } from "@/lib/meta/sync-ad-spend";
import { fetchAdThumbnails } from "@/lib/meta/creative";
import type { Offer } from "@/lib/types/offer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder do supabase-js
function applyOfferFilter(query: any, offerId: string | null): any {
  return offerId ? query.eq("offer_id", offerId) : query;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export type CreativeMaturity = "saturado" | "escalavel" | "neutro";

export type CreativeInsight = {
  adId: string;
  name: string;
  campaignName: string;
  spend: number;
  revenue: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  previousCtr: number | null;
  frequency: number | null;
  roas: number | null;
  cpm: number | null;
  thumbnailUrl: string | null;
  maturity: CreativeMaturity;
  recommendation: string;
};

type FlatAdRow = {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
};

async function fetchAdLevelRows(supabase: SupabaseClient, filters: ReportFilters): Promise<FlatAdRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("ad_spend")
      .select("ad_id, ad_name, campaign_name, spend, clicks, impressions, reach")
      .gte("date", isoDate(filters.since))
      .lte("date", isoDate(filters.until)),
    filters.offerId,
  );
  const { data } = await query;
  return (data as FlatAdRow[] | null) ?? [];
}

function aggregateByAd(rows: FlatAdRow[]) {
  const map = new Map<
    string,
    { name: string; campaignName: string; spend: number; clicks: number; impressions: number; reach: number }
  >();
  for (const row of rows) {
    if (!row.ad_id) continue;
    if (!map.has(row.ad_id)) {
      map.set(row.ad_id, {
        name: row.ad_name || row.ad_id,
        campaignName: row.campaign_name || "—",
        spend: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
      });
    }
    const acc = map.get(row.ad_id)!;
    acc.spend += Number(row.spend);
    acc.clicks += Number(row.clicks);
    acc.impressions += Number(row.impressions);
    acc.reach += Number(row.reach);
    if (row.campaign_name) acc.campaignName = row.campaign_name;
    if (row.ad_name) acc.name = row.ad_name;
  }
  return map;
}

// Heurística de maturidade do criativo (ajustável, não vem de nenhum
// benchmark oficial da Meta): frequência alta + CTR caindo vs. o período
// anterior = saturado (recomenda pausar); frequência baixa + CTR alto =
// escalável (recomenda aumentar orçamento); qualquer outra combinação =
// neutro (recomenda testar variação/monitorar).
const SATURATION_FREQUENCY_THRESHOLD = 3;
const SATURATION_CTR_DROP_PCT = 15;
const SCALABLE_FREQUENCY_THRESHOLD = 1.5;
const SCALABLE_CTR_THRESHOLD = 1.5;

function classifyMaturity(
  frequency: number | null,
  ctr: number | null,
  previousCtr: number | null,
): { maturity: CreativeMaturity; recommendation: string } {
  if (
    frequency !== null &&
    frequency >= SATURATION_FREQUENCY_THRESHOLD &&
    ctr !== null &&
    previousCtr !== null &&
    previousCtr > 0 &&
    ctr < previousCtr * (1 - SATURATION_CTR_DROP_PCT / 100)
  ) {
    return { maturity: "saturado", recommendation: "Pausar" };
  }
  if (
    frequency !== null &&
    frequency <= SCALABLE_FREQUENCY_THRESHOLD &&
    ctr !== null &&
    ctr >= SCALABLE_CTR_THRESHOLD
  ) {
    return { maturity: "escalavel", recommendation: "Escalar orçamento" };
  }
  return { maturity: "neutro", recommendation: "Testar variação" };
}

export async function getCreativeInsights(
  supabase: SupabaseClient,
  filters: ReportFilters,
  offer: Offer | null,
): Promise<CreativeInsight[]> {
  const previousFilters = getPreviousPeriodFilters(filters);

  // Revenue por ad_id (só match exato — mesma limitação da aba Campanhas)
  // reaproveitando a mesma fonte de dados que já existia (campaign_performance).
  const revenueQuery = applyOfferFilter(
    supabase
      .from("campaign_performance")
      .select("ad_id, revenue")
      .gte("date", isoDate(filters.since))
      .lte("date", isoDate(filters.until)),
    filters.offerId,
  );

  const [currentRows, previousRows, { data: revenueRows }] = await Promise.all([
    fetchAdLevelRows(supabase, filters),
    fetchAdLevelRows(supabase, previousFilters),
    revenueQuery,
  ]);

  const current = aggregateByAd(currentRows);
  const previous = aggregateByAd(previousRows);

  const revenueByAd = new Map<string, number>();
  for (const row of (revenueRows as { ad_id: string; revenue: number }[] | null) ?? []) {
    revenueByAd.set(row.ad_id, (revenueByAd.get(row.ad_id) ?? 0) + Number(row.revenue));
  }

  const adIds = Array.from(current.keys()).filter((id) => current.get(id)!.spend > 0);
  const token = offer ? resolveMetaAdsToken(offer) : null;
  const thumbnails = token ? await fetchAdThumbnails(adIds, token) : {};

  const insights: CreativeInsight[] = adIds.map((adId) => {
    const acc = current.get(adId)!;
    const revenue = revenueByAd.get(adId) ?? 0;
    const metrics = computeAdMetrics({
      spend: acc.spend,
      revenue,
      salesCount: 0,
      clicks: acc.clicks,
      impressions: acc.impressions,
      reach: acc.reach,
    });
    const prevAcc = previous.get(adId);
    const previousCtr = prevAcc && prevAcc.impressions > 0 ? (prevAcc.clicks / prevAcc.impressions) * 100 : null;
    const { maturity, recommendation } = classifyMaturity(metrics.frequency, metrics.ctr, previousCtr);

    return {
      adId,
      name: acc.name,
      campaignName: acc.campaignName,
      spend: acc.spend,
      revenue,
      clicks: acc.clicks,
      impressions: acc.impressions,
      ctr: metrics.ctr,
      previousCtr,
      frequency: metrics.frequency,
      roas: metrics.roas,
      cpm: metrics.cpm,
      thumbnailUrl: thumbnails[adId] ?? null,
      maturity,
      recommendation,
    };
  });

  return insights;
}
