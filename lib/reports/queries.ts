import type { SupabaseClient } from "@supabase/supabase-js";

import type { Offer } from "@/lib/types/offer";
import type {
  CampaignAdRow,
  CampaignRow,
  FunnelStep,
  HourlyRow,
  KpiSummary,
  PaymentBreakdownRow,
  ProductSalesRow,
  RegionRow,
  ReportFilters,
  TimeSeriesPoint,
} from "./types";
import { buildFunnelSteps } from "./funnel-utils";

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
  initiated_count: number;
  meta_checkouts: number;
  // Comissão líquida (sales.net_value, soma das entradas PRODUCER de
  // data.commissions — sem a taxa da Hotmart) e vendas pendentes, ambas
  // migration 0018.
  net_commission: number;
  refunded_net_commission: number;
  pending_value: number;
  pending_count: number;
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
    initiated_count: Number(row.initiated_count),
    meta_checkouts: Number(row.meta_checkouts),
    net_commission: Number(row.net_commission),
    refunded_net_commission: Number(row.refunded_net_commission),
    pending_value: Number(row.pending_value),
    pending_count: Number(row.pending_count),
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
  let netCommission = 0;
  let refundedNetCommission = 0;
  let refundedCount = 0;
  let salesCount = 0;
  let adSpend = 0;
  let taxTotal = 0;
  let pendingValue = 0;
  let pendingCount = 0;

  for (const row of dailyRows) {
    grossRevenue += row.gross_revenue;
    netCommission += row.net_commission;
    refundedNetCommission += row.refunded_net_commission;
    refundedCount += row.refunded_count;
    salesCount += row.sales_count;
    adSpend += row.ad_spend;
    pendingValue += row.pending_value;
    pendingCount += row.pending_count;
    const taxRate = taxRateByOffer.get(row.offer_id) ?? 0;
    taxTotal += (row.net_commission * taxRate) / 100;
  }

  const initiatedCheckouts = funnelRows.reduce((sum, row) => sum + row.initiate_checkout, 0);

  // "Líquido" = comissão que a usuária de fato recebe (sales.net_value,
  // soma das entradas PRODUCER de data.commissions — já sem a taxa da
  // Hotmart) das vendas APROVADAS no período. Reembolso é uma métrica à
  // parte ("Vendas reembolsadas"), não é descontado daqui — conferido
  // contra a mesma convenção de outra ferramenta do mercado (Utmify):
  // faturamento líquido, ROAS e margem não subtraem reembolso, só o card
  // de reembolso mostra esse valor separadamente.
  const netRevenue = netCommission;
  const profit = netRevenue - adSpend - taxTotal;

  return {
    grossRevenue,
    netRevenue,
    adSpend,
    roas: adSpend > 0 ? netRevenue / adSpend : null,
    profit,
    cpa: salesCount > 0 ? adSpend / salesCount : null,
    marginPct: netRevenue > 0 ? (profit / netRevenue) * 100 : null,
    averageTicket: salesCount > 0 ? grossRevenue / salesCount : 0,
    salesCount,
    refundRatePct: salesCount + refundedCount > 0 ? (refundedCount / (salesCount + refundedCount)) * 100 : null,
    refundedCount,
    // Valor da comissão (não o bruto) que voltou por reembolso/chargeback —
    // mesma convenção do faturamento líquido acima.
    refundedValue: refundedNetCommission,
    initiatedCheckouts,
    costPerCheckout: initiatedCheckouts > 0 ? adSpend / initiatedCheckouts : null,
    pendingValue,
    pendingCount,
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
  const metaCheckouts = dailyRows.reduce((sum, row) => sum + row.meta_checkouts, 0);
  const trackedCheckouts = funnelRows.reduce((sum, row) => sum + row.initiate_checkout, 0);
  // Prefere o InitiateCheckout reportado pela própria Meta (pixel/CAPI) —
  // mais confiável que o clique rastreado pelo track.js (só conta cliques
  // em links de checkout Hotmart; sub-conta se o checkout usa redirect via
  // JS, embed, etc. em vez de <a href>). Cai pro rastreamento próprio só
  // se a Meta não retornou nada (oferta sem Pixel/CAPI configurado).
  const initiateCheckout = metaCheckouts > 0 ? metaCheckouts : trackedCheckouts;
  const initiatedSales = dailyRows.reduce((sum, row) => sum + row.initiated_count, 0);
  const approvedSales = dailyRows.reduce((sum, row) => sum + row.sales_count, 0);

  return buildFunnelSteps([
    { label: "Cliques", count: clicks },
    { label: "Visualizações de página", count: pageviews },
    { label: "Checkouts iniciados", count: initiateCheckout },
    { label: "Vendas iniciadas", count: initiatedSales },
    { label: "Vendas aprovadas", count: approvedSales },
  ]);
}

// ── Série temporal ────────────────────────────────────────────────────

// Segunda primeiro (convenção BR), diferente do getDay() nativo (que
// começa no domingo) — usado só pela granularidade "dia da semana".
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function bucketKey(dateStr: string, granularity: ReportFilters["granularity"]): string {
  if (granularity === "day" || granularity === "hour") return dateStr;
  if (granularity === "month") return dateStr.slice(0, 7);
  const d = new Date(`${dateStr}T00:00:00`);
  if (granularity === "weekday") {
    const isoIndex = (d.getDay() + 6) % 7;
    return String(isoIndex);
  }
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function bucketLabel(key: string, granularity: ReportFilters["granularity"]): string {
  if (granularity === "month") {
    const [year, month] = key.split("-");
    return `${month}/${year}`;
  }
  if (granularity === "weekday") return WEEKDAY_LABELS[Number(key)] ?? key;
  if (granularity === "week") return `sem. ${key.slice(5)}`;
  return key.slice(5).split("-").reverse().join("/");
}

// Converte um timestamp UTC pra hora local (0-23) num fuso IANA — usado
// pra quebra de vendas por hora do dia respeitar o fuso da oferta em vez
// de sempre UTC/hora do servidor. Só faz sentido com uma oferta específica
// selecionada (fusos diferentes por oferta não têm uma hora "combinada"
// sensata em "todas as ofertas" — cai pro fuso passado, default UTC).
function hourInTimezone(isoString: string, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date(isoString));
    const hour = parseInt(formatted, 10);
    return hour === 24 ? 0 : hour;
  } catch {
    return new Date(isoString).getUTCHours();
  }
}

async function getHourlyRevenue(
  supabase: SupabaseClient,
  filters: ReportFilters,
  timezone = "UTC",
): Promise<{ hour: number; revenue: number; count: number }[]> {
  const query = applyOfferFilter(
    supabase
      .from("sales")
      .select("gross_value, net_value, approved_at, offer_id")
      .eq("status", "approved")
      .gte("approved_at", filters.since.toISOString())
      .lte("approved_at", filters.until.toISOString()),
    filters.offerId,
  );
  const { data } = await query;

  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, count: 0 }));
  for (const row of (data as { gross_value: number; net_value: number | null; approved_at: string }[] | null) ?? []) {
    const hour = hourInTimezone(row.approved_at, timezone);
    // Comissão líquida (sem taxa da Hotmart), com fallback pro bruto quando
    // ainda não capturada — mesma convenção do daily_metrics.
    buckets[hour]!.revenue += Number(row.net_value ?? row.gross_value ?? 0);
    buckets[hour]!.count += 1;
  }
  return buckets;
}

export async function getTimeSeries(
  supabase: SupabaseClient,
  filters: ReportFilters,
  timezone = "UTC",
  overrideGranularity?: ReportFilters["granularity"],
): Promise<TimeSeriesPoint[]> {
  const granularity = overrideGranularity ?? filters.granularity;

  if (granularity === "hour") {
    const [hourly, dailyRows] = await Promise.all([
      getHourlyRevenue(supabase, filters, timezone),
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
  const buckets = new Map<string, { revenue: number; adSpend: number }>();

  for (const row of dailyRows) {
    const key = bucketKey(row.date, granularity);
    const existing = buckets.get(key) ?? { revenue: 0, adSpend: 0 };
    // Comissão líquida (sem taxa da Hotmart) — mesma base do KPI
    // "Faturamento líquido" (não desconta reembolso, que é uma métrica à
    // parte — ver getKpis), pro gráfico e os cards baterem entre si.
    existing.revenue += row.net_commission;
    existing.adSpend += row.ad_spend;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      bucket: key,
      label: bucketLabel(key, granularity),
      revenue: value.revenue,
      adSpend: value.adSpend,
      // Lucro aqui não desconta imposto (varia por oferta) — ver KPI
      // "Lucro" para o valor com imposto considerado.
      profit: value.revenue - value.adSpend,
    }));
}

// ── Tabela de campanhas/conjuntos/anúncios ───────────────────────────

type CampaignPerformanceRow = {
  offer_id: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  revenue: number;
  sales_count: number;
};

export function computeAdMetrics(base: {
  spend: number;
  revenue: number;
  salesCount: number;
  clicks: number;
  impressions: number;
  reach: number;
}) {
  return {
    roas: base.spend > 0 ? base.revenue / base.spend : null,
    cpa: base.salesCount > 0 ? base.spend / base.salesCount : null,
    ctr: base.impressions > 0 ? (base.clicks / base.impressions) * 100 : null,
    cpc: base.clicks > 0 ? base.spend / base.clicks : null,
    cpm: base.impressions > 0 ? (base.spend / base.impressions) * 1000 : null,
    // Frequência = impressões / alcance (definição da própria Meta) —
    // recalculada aqui em vez de somar/tirar média das frequências diárias,
    // que distorceria o valor. "Alcance" somado no período é uma
    // aproximação (a Meta não deduplica alcance entre dias).
    frequency: base.reach > 0 ? base.impressions / base.reach : null,
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
    offerId: string;
    spend: number;
    revenue: number;
    salesCount: number;
    clicks: number;
    impressions: number;
    reach: number;
  };

  const campaigns = new Map<string, Acc & { adsets: Map<string, Acc & { name: string; ads: Map<string, Acc> }> }>();

  for (const row of rows) {
    if (!row.campaign_id) continue;

    if (!campaigns.has(row.campaign_id)) {
      campaigns.set(row.campaign_id, {
        name: row.campaign_name || row.campaign_id,
        offerId: row.offer_id,
        spend: 0,
        revenue: 0,
        salesCount: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
        adsets: new Map(),
      });
    }
    const campaign = campaigns.get(row.campaign_id)!;
    campaign.spend += Number(row.spend);
    campaign.revenue += Number(row.revenue);
    campaign.salesCount += Number(row.sales_count);
    campaign.clicks += Number(row.clicks);
    campaign.impressions += Number(row.impressions);
    campaign.reach += Number(row.reach);
    if (row.campaign_name) campaign.name = row.campaign_name;

    const adsetId = row.adset_id || "sem-conjunto";
    if (!campaign.adsets.has(adsetId)) {
      campaign.adsets.set(adsetId, {
        name: row.adset_name || adsetId,
        offerId: row.offer_id,
        spend: 0,
        revenue: 0,
        salesCount: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
        ads: new Map(),
      });
    }
    const adset = campaign.adsets.get(adsetId)!;
    adset.spend += Number(row.spend);
    adset.revenue += Number(row.revenue);
    adset.salesCount += Number(row.sales_count);
    adset.clicks += Number(row.clicks);
    adset.impressions += Number(row.impressions);
    adset.reach += Number(row.reach);
    if (row.adset_name) adset.name = row.adset_name;

    const adId = row.ad_id || "sem-anuncio";
    if (!adset.ads.has(adId)) {
      adset.ads.set(adId, {
        name: row.ad_name || adId,
        offerId: row.offer_id,
        spend: 0,
        revenue: 0,
        salesCount: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
      });
    }
    const ad = adset.ads.get(adId)!;
    ad.spend += Number(row.spend);
    ad.revenue += Number(row.revenue);
    ad.salesCount += Number(row.sales_count);
    ad.clicks += Number(row.clicks);
    ad.impressions += Number(row.impressions);
    ad.reach += Number(row.reach);
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
  timezone = "UTC",
): Promise<HourlyRow[]> {
  const hourly = await getHourlyRevenue(supabase, filters, timezone);
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

export async function getSalesByProduct(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<ProductSalesRow[]> {
  const query = applyOfferFilter(
    supabase
      .from("sales")
      .select("product_id, product_name, gross_value")
      .eq("status", "approved")
      .gte("approved_at", filters.since.toISOString())
      .lte("approved_at", filters.until.toISOString()),
    filters.offerId,
  );
  const { data } = await query;

  const byProduct = new Map<string, { productName: string; count: number; value: number }>();
  for (const row of (data as { product_id: string | null; product_name: string | null; gross_value: number | null }[] | null) ?? []) {
    const key = row.product_id || "sem-produto";
    const existing = byProduct.get(key) ?? { productName: row.product_name || key, count: 0, value: 0 };
    existing.count += 1;
    existing.value += Number(row.gross_value ?? 0);
    if (row.product_name) existing.productName = row.product_name;
    byProduct.set(key, existing);
  }

  const totalValue = Array.from(byProduct.values()).reduce((sum, p) => sum + p.value, 0);

  return Array.from(byProduct.entries())
    .map(([productId, p]) => ({
      productId,
      productName: p.productName,
      count: p.count,
      value: p.value,
      pct: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}
