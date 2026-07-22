import type { SupabaseClient } from "@supabase/supabase-js";

import type { Offer } from "@/lib/types/offer";
import type {
  CampaignAdRow,
  CampaignRow,
  FunnelStep,
  HourlyRow,
  KpiSummary,
  PaymentBreakdownRow,
  RegionRow,
  ReportFilters,
  TimeSeriesPoint,
} from "./types";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Os builders do supabase-js têm tipos genéricos profundos demais para
// compor aqui sem estourar o instantiation depth do TS — any é intencional.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOfferFilter(query: any, offerId: string | null): any {
  return offerId ? query.eq("offer_id", offerId) : query;
}

type DailyMetricsRow = {
  offer_id: string;
  date: string;
  gross_revenue: number;
  sales_count: number;
  refunded_value: number;
  refunded_count: number;
  ad_spend: number;
  clicks: number;
  impressions: number;
};

async function fetchDailyMetrics(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<DailyMetricsRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("daily_metrics")
      .select("*")
      .gte("date", isoDate(filters.since))
      .lte("date", isoDate(filters.until)),
    filters.offerId,
  );
  const { data } = await query;
  return ((data as DailyMetricsRow[] | null) ?? []).map((row) => ({
    ...row,
    gross_revenue: Number(row.gross_revenue),
    sales_count: Number(row.sales_count),
    refunded_value: Number(row.refunded_value),
    refunded_count: Number(row.refunded_count),
    ad_spend: Number(row.ad_spend),
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
  }));
}

type FunnelByOfferRow = {
  offer_id: string;
  date: string;
  pageviews: number;
  view_content: number;
  add_to_cart: number;
  initiate_checkout: number;
};

async function fetchFunnelByOffer(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<FunnelByOfferRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("funnel_by_offer")
      .select("*")
      .gte("date", isoDate(filters.since))
      .lte("date", isoDate(filters.until)),
    filters.offerId,
  );
  const { data } = await query;
  return (data as FunnelByOfferRow[] | null) ?? [];
}

// ── KPIs ──────────────────────────────────────────────────────────────

export async function getKpis(
  supabase: SupabaseClient,
  filters: ReportFilters,
  offers: Offer[],
): Promise<KpiSummary> {
  const [dailyRows, funnelRows] = await Promise.all([
    fetchDailyMetrics(supabase, filters),
    fetchFunnelByOffer(supabase, filters),
  ]);

  const taxRateByOffer = new Map(offers.map((o) => [o.id, o.tax_rate]));

  let grossRevenue = 0;
  let refundedValue = 0;
  let refundedCount = 0;
  let salesCount = 0;
  let adSpend = 0;
  let taxTotal = 0;

  for (const row of dailyRows) {
    grossRevenue += row.gross_revenue;
    refundedValue += row.refunded_value;
    refundedCount += row.refunded_count;
    salesCount += row.sales_count;
    adSpend += row.ad_spend;
    const taxRate = taxRateByOffer.get(row.offer_id) ?? 0;
    taxTotal += (row.gross_revenue * taxRate) / 100;
  }

  const initiatedCheckouts = funnelRows.reduce((sum, row) => sum + row.initiate_checkout, 0);

  // net_value da venda ainda não é calculado (Sprint 3) — "líquido" aqui é
  // uma aproximação (bruto − reembolsos), sem descontar taxa da Hotmart.
  const netRevenue = grossRevenue - refundedValue;
  const profit = netRevenue - adSpend - taxTotal;

  return {
    grossRevenue,
    netRevenue,
    adSpend,
    roas: adSpend > 0 ? grossRevenue / adSpend : null,
    profit,
    cpa: salesCount > 0 ? adSpend / salesCount : null,
    marginPct: grossRevenue > 0 ? (profit / grossRevenue) * 100 : null,
    averageTicket: salesCount > 0 ? grossRevenue / salesCount : 0,
    salesCount,
    refundRatePct: salesCount + refundedCount > 0 ? (refundedCount / (salesCount + refundedCount)) * 100 : null,
    refundedCount,
    refundedValue,
    initiatedCheckouts,
    costPerCheckout: initiatedCheckouts > 0 ? adSpend / initiatedCheckouts : null,
  };
}

// ── Funil ─────────────────────────────────────────────────────────────

export async function getFunnel(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<FunnelStep[]> {
  const [dailyRows, funnelRows] = await Promise.all([
    fetchDailyMetrics(supabase, filters),
    fetchFunnelByOffer(supabase, filters),
  ]);

  const clicks = dailyRows.reduce((sum, row) => sum + row.clicks, 0);
  const pageviews = funnelRows.reduce((sum, row) => sum + row.pageviews, 0);
  const addToCart = funnelRows.reduce((sum, row) => sum + row.add_to_cart, 0);
  const initiateCheckout = funnelRows.reduce((sum, row) => sum + row.initiate_checkout, 0);
  const purchases = dailyRows.reduce((sum, row) => sum + row.sales_count, 0);

  const counts = [
    { label: "Cliques", count: clicks },
    { label: "Visualizações de página", count: pageviews },
    { label: "Adições ao carrinho", count: addToCart },
    { label: "Checkouts iniciados", count: initiateCheckout },
    { label: "Compras realizadas", count: purchases },
  ];

  const first = counts[0]?.count || 0;

  return counts.map((step, index) => {
    const previous = index > 0 ? counts[index - 1]!.count : null;
    return {
      label: step.label,
      count: step.count,
      conversionFromPrevious: previous && previous > 0 ? (step.count / previous) * 100 : null,
      conversionFromFirst: first > 0 ? (step.count / first) * 100 : null,
    };
  });
}

// ── Série temporal ────────────────────────────────────────────────────

function bucketKey(dateStr: string, granularity: ReportFilters["granularity"]): string {
  if (granularity === "day" || granularity === "hour") return dateStr;
  if (granularity === "month") return dateStr.slice(0, 7);
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function bucketLabel(key: string, granularity: ReportFilters["granularity"]): string {
  if (granularity === "month") {
    const [year, month] = key.split("-");
    return `${month}/${year}`;
  }
  if (granularity === "week") return `sem. ${key.slice(5)}`;
  return key.slice(5).split("-").reverse().join("/");
}

async function getHourlyRevenue(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<{ hour: number; revenue: number; count: number }[]> {
  const query = applyOfferFilter(
    supabase
      .from("sales")
      .select("gross_value, approved_at, offer_id")
      .eq("status", "approved")
      .gte("approved_at", filters.since.toISOString())
      .lte("approved_at", filters.until.toISOString()),
    filters.offerId,
  );
  const { data } = await query;

  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, count: 0 }));
  for (const row of (data as { gross_value: number; approved_at: string }[] | null) ?? []) {
    const hour = new Date(row.approved_at).getHours();
    buckets[hour]!.revenue += Number(row.gross_value ?? 0);
    buckets[hour]!.count += 1;
  }
  return buckets;
}

export async function getTimeSeries(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<TimeSeriesPoint[]> {
  if (filters.granularity === "hour") {
    const [hourly, dailyRows] = await Promise.all([
      getHourlyRevenue(supabase, filters),
      fetchDailyMetrics(supabase, filters),
    ]);
    const totalSpend = dailyRows.reduce((sum, row) => sum + row.ad_spend, 0);
    const spendPerHour = totalSpend / 24;
    return hourly.map((h) => ({
      bucket: String(h.hour),
      label: `${String(h.hour).padStart(2, "0")}h`,
      revenue: h.revenue,
      adSpend: spendPerHour,
      profit: h.revenue - spendPerHour,
    }));
  }

  const dailyRows = await fetchDailyMetrics(supabase, filters);
  const buckets = new Map<string, { revenue: number; adSpend: number; refunded: number }>();

  for (const row of dailyRows) {
    const key = bucketKey(row.date, filters.granularity);
    const existing = buckets.get(key) ?? { revenue: 0, adSpend: 0, refunded: 0 };
    existing.revenue += row.gross_revenue;
    existing.adSpend += row.ad_spend;
    existing.refunded += row.refunded_value;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      bucket: key,
      label: bucketLabel(key, filters.granularity),
      revenue: value.revenue,
      adSpend: value.adSpend,
      // Lucro aqui não desconta imposto (varia por oferta) — ver KPI
      // "Lucro" para o valor com imposto considerado.
      profit: value.revenue - value.refunded - value.adSpend,
    }));
}

// ── Tabela de campanhas/conjuntos/anúncios ───────────────────────────

type CampaignPerformanceRow = {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  revenue: number;
  sales_count: number;
};

function computeAdMetrics(base: {
  spend: number;
  revenue: number;
  salesCount: number;
  clicks: number;
  impressions: number;
}) {
  return {
    roas: base.spend > 0 ? base.revenue / base.spend : null,
    cpa: base.salesCount > 0 ? base.spend / base.salesCount : null,
    ctr: base.impressions > 0 ? (base.clicks / base.impressions) * 100 : null,
  };
}

export async function getCampaignTable(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<CampaignRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("campaign_performance")
      .select("*")
      .gte("date", isoDate(filters.since))
      .lte("date", isoDate(filters.until)),
    filters.offerId,
  );
  const { data } = await query;
  const rows = (data as CampaignPerformanceRow[] | null) ?? [];

  type Acc = {
    name: string;
    spend: number;
    revenue: number;
    salesCount: number;
    clicks: number;
    impressions: number;
  };

  const campaigns = new Map<string, Acc & { adsets: Map<string, Acc & { name: string; ads: Map<string, Acc> }> }>();

  for (const row of rows) {
    if (!row.campaign_id) continue;

    if (!campaigns.has(row.campaign_id)) {
      campaigns.set(row.campaign_id, {
        name: row.campaign_name || row.campaign_id,
        spend: 0,
        revenue: 0,
        salesCount: 0,
        clicks: 0,
        impressions: 0,
        adsets: new Map(),
      });
    }
    const campaign = campaigns.get(row.campaign_id)!;
    campaign.spend += Number(row.spend);
    campaign.revenue += Number(row.revenue);
    campaign.salesCount += Number(row.sales_count);
    campaign.clicks += Number(row.clicks);
    campaign.impressions += Number(row.impressions);
    if (row.campaign_name) campaign.name = row.campaign_name;

    const adsetId = row.adset_id || "sem-conjunto";
    if (!campaign.adsets.has(adsetId)) {
      campaign.adsets.set(adsetId, {
        name: row.adset_name || adsetId,
        spend: 0,
        revenue: 0,
        salesCount: 0,
        clicks: 0,
        impressions: 0,
        ads: new Map(),
      });
    }
    const adset = campaign.adsets.get(adsetId)!;
    adset.spend += Number(row.spend);
    adset.revenue += Number(row.revenue);
    adset.salesCount += Number(row.sales_count);
    adset.clicks += Number(row.clicks);
    adset.impressions += Number(row.impressions);
    if (row.adset_name) adset.name = row.adset_name;

    const adId = row.ad_id || "sem-anuncio";
    if (!adset.ads.has(adId)) {
      adset.ads.set(adId, {
        name: row.ad_name || adId,
        spend: 0,
        revenue: 0,
        salesCount: 0,
        clicks: 0,
        impressions: 0,
      });
    }
    const ad = adset.ads.get(adId)!;
    ad.spend += Number(row.spend);
    ad.revenue += Number(row.revenue);
    ad.salesCount += Number(row.sales_count);
    ad.clicks += Number(row.clicks);
    ad.impressions += Number(row.impressions);
    if (row.ad_name) ad.name = row.ad_name;
  }

  function toAdRow(id: string, acc: Acc): CampaignAdRow {
    return { ...acc, id, ...computeAdMetrics(acc) };
  }

  const result: CampaignRow[] = Array.from(campaigns.entries()).map(([campaignId, campaign]) => ({
    ...toAdRow(campaignId, campaign),
    adsets: Array.from(campaign.adsets.entries()).map(([adsetId, adset]) => ({
      ...toAdRow(adsetId, adset),
      ads: Array.from(adset.ads.entries()).map(([adId, ad]) => toAdRow(adId, ad)),
    })),
  }));

  return result.sort((a, b) => b.spend - a.spend);
}

// ── Pagamento, hora do dia, região ────────────────────────────────────

export async function getPaymentBreakdown(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<PaymentBreakdownRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("sales")
      .select("payment_method, gross_value")
      .eq("status", "approved")
      .gte("approved_at", filters.since.toISOString())
      .lte("approved_at", filters.until.toISOString()),
    filters.offerId,
  );
  const { data } = await query;

  const byMethod = new Map<string, { count: number; value: number }>();
  for (const row of (data as { payment_method: string | null; gross_value: number | null }[] | null) ?? []) {
    const method = row.payment_method || "outro";
    const existing = byMethod.get(method) ?? { count: 0, value: 0 };
    existing.count += 1;
    existing.value += Number(row.gross_value ?? 0);
    byMethod.set(method, existing);
  }

  return Array.from(byMethod.entries()).map(([method, v]) => ({ method, ...v }));
}

export async function getHourlyBreakdown(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<HourlyRow[]> {
  const hourly = await getHourlyRevenue(supabase, filters);
  return hourly.map((h) => ({ hour: h.hour, count: h.count }));
}

export async function getRegionRanking(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<RegionRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("visitors")
      .select("region, city")
      .gte("first_seen_at", filters.since.toISOString())
      .lte("first_seen_at", filters.until.toISOString()),
    filters.offerId,
  );
  const { data } = await query;

  const byRegion = new Map<string, RegionRow>();
  for (const row of (data as { region: string | null; city: string | null }[] | null) ?? []) {
    if (!row.region) continue;
    const key = `${row.region}__${row.city ?? ""}`;
    const existing = byRegion.get(key) ?? { region: row.region, city: row.city, count: 0 };
    existing.count += 1;
    byRegion.set(key, existing);
  }

  return Array.from(byRegion.values()).sort((a, b) => b.count - a.count).slice(0, 15);
}
