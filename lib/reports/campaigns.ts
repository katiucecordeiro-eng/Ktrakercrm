import type { SupabaseClient } from "@supabase/supabase-js";

import { computeAdMetrics } from "./queries";
import type { CampaignAdRow, CampaignRow, ReportFilters, RoasPoint } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder do supabase-js
function applyOfferFilter(query: any, offerId: string | null): any {
  return offerId ? query.eq("offer_id", offerId) : query;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeForMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type AdSpendRow = {
  offer_id: string;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
};

type SaleAttributionRow = {
  offer_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  utm_campaign: string | null;
  gross_value: number | null;
};

type Acc = {
  name: string;
  offerId: string;
  spend: number;
  revenue: number;
  salesCount: number;
  clicks: number;
  impressions: number;
  reach: number;
};

type CampaignAcc = Acc & {
  adsets: Map<string, Acc & { name: string; ads: Map<string, Acc> }>;
};

function emptyAcc(name: string, offerId: string): Acc {
  return { name, offerId, spend: 0, revenue: 0, salesCount: 0, clicks: 0, impressions: 0, reach: 0 };
}

function toAdRow(id: string, acc: Acc): CampaignAdRow {
  return { ...acc, id, ...computeAdMetrics(acc) };
}

async function fetchAdSpendRows(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<AdSpendRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("ad_spend")
      .select(
        "offer_id, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, clicks, impressions, reach",
      )
      .gte("date", isoDate(filters.since))
      .lte("date", isoDate(filters.until)),
    filters.offerId,
  );
  const { data } = await query;
  return (data as AdSpendRow[] | null) ?? [];
}

async function fetchApprovedSales(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<SaleAttributionRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("sales")
      .select("offer_id, campaign_id, adset_id, ad_id, utm_campaign, gross_value")
      .eq("status", "approved")
      .gte("approved_at", filters.since.toISOString())
      .lte("approved_at", filters.until.toISOString()),
    filters.offerId,
  );
  const { data } = await query;
  return (data as SaleAttributionRow[] | null) ?? [];
}

async function fetchManualMappings(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<Map<string, string>> {
  const query = applyOfferFilter(
    supabase.from("campaign_utm_mappings").select("offer_id, raw_utm_campaign, campaign_id"),
    filters.offerId,
  );
  const { data } = await query;
  const map = new Map<string, string>();
  for (const row of (data as { offer_id: string; raw_utm_campaign: string; campaign_id: string }[] | null) ?? []) {
    map.set(`${row.offer_id}::${row.raw_utm_campaign}`, row.campaign_id);
  }
  return map;
}

// Resolve a campanha real de uma venda em 3 níveis de confiança:
// 1) match exato do campaign_id extraído da UTM contra um campaign_id real
//    (convenção {{campaign.id}}--{{campaign.name}} seguida corretamente);
// 2) mapeamento manual cadastrado em Configurações (offer_id + utm_campaign
//    bruto → campaign_id real), pra quando o nome não bate por fuzzy match;
// 3) fallback por nome: normaliza o utm_campaign bruto e a campanha real e
//    testa se um contém o outro — cobre o caso de o anúncio usar o nome da
//    campanha como utm_campaign em vez do id.
// Sem nenhum dos três, a venda cai no bucket "sem atribuição".
function resolveCampaignId(
  sale: SaleAttributionRow,
  realCampaigns: Map<string, { campaignName: string | null }>,
  manualMappings: Map<string, string>,
): string | null {
  if (sale.campaign_id) {
    const key = `${sale.offer_id}::${sale.campaign_id}`;
    if (realCampaigns.has(key)) return sale.campaign_id;
  }

  if (sale.utm_campaign) {
    const manual = manualMappings.get(`${sale.offer_id}::${sale.utm_campaign}`);
    if (manual && realCampaigns.has(`${sale.offer_id}::${manual}`)) return manual;

    const needle = normalizeForMatch(sale.utm_campaign);
    if (needle) {
      for (const [key, campaign] of realCampaigns) {
        if (!key.startsWith(`${sale.offer_id}::`)) continue;
        const name = normalizeForMatch(campaign.campaignName ?? "");
        if (name && (name.includes(needle) || needle.includes(name))) {
          return key.slice(`${sale.offer_id}::`.length);
        }
      }
    }
  }

  return null;
}

export async function getCampaignsFullTable(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<{ rows: CampaignRow[]; unattributedRevenue: number; unattributedCount: number }> {
  const [adSpendRows, sales, manualMappings] = await Promise.all([
    fetchAdSpendRows(supabase, filters),
    fetchApprovedSales(supabase, filters),
    fetchManualMappings(supabase, filters),
  ]);

  const campaigns = new Map<string, CampaignAcc>();
  const realCampaigns = new Map<string, { campaignName: string | null }>();

  for (const row of adSpendRows) {
    if (!row.campaign_id) continue;
    const campaignKey = `${row.offer_id}::${row.campaign_id}`;
    realCampaigns.set(campaignKey, { campaignName: row.campaign_name });

    if (!campaigns.has(campaignKey)) {
      campaigns.set(campaignKey, {
        ...emptyAcc(row.campaign_name || row.campaign_id, row.offer_id),
        adsets: new Map(),
      });
    }
    const campaign = campaigns.get(campaignKey)!;
    campaign.spend += Number(row.spend);
    campaign.clicks += Number(row.clicks);
    campaign.impressions += Number(row.impressions);
    campaign.reach += Number(row.reach);
    if (row.campaign_name) campaign.name = row.campaign_name;

    const adsetId = row.adset_id || "sem-conjunto";
    if (!campaign.adsets.has(adsetId)) {
      campaign.adsets.set(adsetId, {
        ...emptyAcc(row.adset_name || adsetId, row.offer_id),
        ads: new Map(),
      });
    }
    const adset = campaign.adsets.get(adsetId)!;
    adset.spend += Number(row.spend);
    adset.clicks += Number(row.clicks);
    adset.impressions += Number(row.impressions);
    adset.reach += Number(row.reach);
    if (row.adset_name) adset.name = row.adset_name;

    const adId = row.ad_id || "sem-anuncio";
    if (!adset.ads.has(adId)) {
      adset.ads.set(adId, emptyAcc(row.ad_name || adId, row.offer_id));
    }
    const ad = adset.ads.get(adId)!;
    ad.spend += Number(row.spend);
    ad.clicks += Number(row.clicks);
    ad.impressions += Number(row.impressions);
    ad.reach += Number(row.reach);
    if (row.ad_name) ad.name = row.ad_name;
  }

  let unattributedRevenue = 0;
  let unattributedCount = 0;

  for (const sale of sales) {
    const revenue = Number(sale.gross_value ?? 0);
    const resolvedCampaignId = resolveCampaignId(sale, realCampaigns, manualMappings);

    if (!resolvedCampaignId) {
      unattributedRevenue += revenue;
      unattributedCount += 1;
      continue;
    }

    const campaignKey = `${sale.offer_id}::${resolvedCampaignId}`;
    const campaign = campaigns.get(campaignKey);
    if (!campaign) {
      unattributedRevenue += revenue;
      unattributedCount += 1;
      continue;
    }

    // Só desce pra conjunto/anúncio quando o próprio id da venda bateu
    // exatamente (fallback por nome/mapeamento manual só garante confiança
    // até o nível de campanha) — evita atribuir a um criativo errado.
    const exactAdset = sale.adset_id ? campaign.adsets.get(sale.adset_id) : undefined;
    const exactAd = exactAdset && sale.ad_id ? exactAdset.ads.get(sale.ad_id) : undefined;

    campaign.revenue += revenue;
    campaign.salesCount += 1;
    if (exactAdset) {
      exactAdset.revenue += revenue;
      exactAdset.salesCount += 1;
      if (exactAd) {
        exactAd.revenue += revenue;
        exactAd.salesCount += 1;
      }
    }
  }

  const ROAS_ACTIVE_THRESHOLD = 0;
  const rows: CampaignRow[] = Array.from(campaigns.entries()).map(([campaignKey, campaign]) => {
    const [, campaignId] = campaignKey.split("::") as [string, string];
    return {
      ...toAdRow(campaignId, campaign),
      status: campaign.spend > ROAS_ACTIVE_THRESHOLD ? "ativo" : "pausado",
      adsets: Array.from(campaign.adsets.entries()).map(([adsetId, adset]) => ({
        ...toAdRow(adsetId, adset),
        ads: Array.from(adset.ads.entries()).map(([adId, ad]) => toAdRow(adId, ad)),
      })),
    };
  });

  rows.sort((a, b) => b.spend - a.spend);

  if (unattributedRevenue > 0 || unattributedCount > 0) {
    rows.push({
      id: "sem-atribuicao",
      name: "Sem atribuição de campanha",
      // Pode abranger vendas de mais de uma oferta em "todas as ofertas" —
      // sem um offerId único, não é gerenciável (sem ações de pausar/orçamento).
      offerId: "",
      spend: 0,
      revenue: unattributedRevenue,
      salesCount: unattributedCount,
      clicks: 0,
      impressions: 0,
      reach: 0,
      roas: null,
      cpa: null,
      ctr: null,
      cpc: null,
      cpm: null,
      frequency: null,
      adsets: [],
      unattributed: true,
    });
  }

  return { rows, unattributedRevenue, unattributedCount };
}

export function getTopCreativesByRoas(rows: CampaignRow[], limit = 5): CampaignAdRow[] {
  const ads: CampaignAdRow[] = [];
  for (const campaign of rows) {
    for (const adset of campaign.adsets) {
      for (const ad of adset.ads) {
        if (ad.spend > 0) ads.push(ad);
      }
    }
  }
  return ads.sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0)).slice(0, limit);
}

export type CampaignSummary = {
  bestCampaign: CampaignAdRow | null;
  bestCreative: CampaignAdRow | null;
  worstCampaign: CampaignAdRow | null;
  totalSpend: number;
  weightedRoas: number | null;
};

export function getCampaignSummary(rows: CampaignRow[]): CampaignSummary {
  const withSpend = rows.filter((r) => !r.unattributed && r.spend > 0);
  const bestCampaign = withSpend.length
    ? withSpend.reduce((best, r) => ((r.roas ?? 0) > (best.roas ?? 0) ? r : best))
    : null;
  const worstCampaign = withSpend.length
    ? withSpend.reduce((worst, r) => ((r.roas ?? 0) < (worst.roas ?? 0) ? r : worst))
    : null;
  const bestCreative = getTopCreativesByRoas(rows, 1)[0] ?? null;
  const totalSpend = rows.reduce((sum, r) => sum + r.spend, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return {
    bestCampaign,
    bestCreative,
    worstCampaign,
    totalSpend,
    weightedRoas: totalSpend > 0 ? totalRevenue / totalSpend : null,
  };
}

export async function getRoasTimeSeries(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<RoasPoint[]> {
  const query = applyOfferFilter(
    supabase
      .from("daily_metrics")
      .select("date, ad_spend, gross_revenue")
      .gte("date", isoDate(filters.since))
      .lte("date", isoDate(filters.until)),
    filters.offerId,
  );
  const { data } = await query;
  const rows = (data as { date: string; ad_spend: number; gross_revenue: number }[] | null) ?? [];

  const buckets = new Map<string, { spend: number; revenue: number }>();
  for (const row of rows) {
    const existing = buckets.get(row.date) ?? { spend: 0, revenue: 0 };
    existing.spend += Number(row.ad_spend);
    existing.revenue += Number(row.gross_revenue);
    buckets.set(row.date, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      bucket: date,
      label: date.slice(5).split("-").reverse().join("/"),
      spend: value.spend,
      revenue: value.revenue,
      roas: value.spend > 0 ? value.revenue / value.spend : null,
    }));
}
