export type Granularity = "hour" | "day" | "week" | "month" | "weekday";

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "custom";

export type ReportFilters = {
  offerId: string | null;
  offerSlug: string | null;
  period: PeriodPreset;
  since: Date;
  until: Date;
  granularity: Granularity;
};

export type KpiSummary = {
  grossRevenue: number;
  netRevenue: number;
  adSpend: number;
  roas: number | null;
  profit: number;
  cpa: number | null;
  marginPct: number | null;
  averageTicket: number;
  salesCount: number;
  refundRatePct: number | null;
  refundedCount: number;
  refundedValue: number;
  initiatedCheckouts: number;
  costPerCheckout: number | null;
};

export type FunnelStep = {
  label: string;
  count: number;
  conversionFromPrevious: number | null;
  conversionFromFirst: number | null;
};

export type TimeSeriesPoint = {
  bucket: string;
  label: string;
  revenue: number;
  adSpend: number;
  profit: number;
};

export type CampaignAdRow = {
  id: string;
  name: string;
  // Necessário pra saber de qual oferta (e portanto qual token da
  // Marketing API) usar ao pausar/ativar ou editar orçamento direto pela
  // tabela — em "todas as ofertas" cada linha pode pertencer a uma oferta
  // diferente. Vazio na linha "sem atribuição" (spans possivelmente mais
  // de uma oferta, não gerenciável).
  offerId: string;
  spend: number;
  revenue: number;
  salesCount: number;
  clicks: number;
  impressions: number;
  reach: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  // Só preenchido a nível de campanha (aba Campanhas) — heurística: gasto
  // > 0 no período selecionado = "ativa" (não vem da Meta, que exigiria uma
  // chamada extra pra buscar effective_status da campanha).
  status?: "ativo" | "pausado";
  // Só preenchidos pela aba Campanhas (getCampaignsFullTable) — a Visão
  // Geral (getCampaignTable) não computa isso, fica undefined lá.
  // PageView vem só de events (não tem equivalente reportado pela Meta);
  // checkout iniciado prefere o valor reportado pela Meta (ad_spend) e cai
  // pro tracked (events) só se a Meta não retornou nada, igual ao funil
  // geral (getFunnel).
  pageviews?: number;
  initiateCheckout?: number;
};

export type CampaignRow = CampaignAdRow & {
  adsets: (CampaignAdRow & { ads: CampaignAdRow[] })[];
  // Marca a linha especial de vendas que não puderam ser atribuídas a
  // nenhuma campanha real (nem por ID exato, nem por fallback/mapeamento
  // manual) — sempre a última da lista, sem adsets.
  unattributed?: boolean;
};

export type RoasPoint = {
  bucket: string;
  label: string;
  spend: number;
  revenue: number;
  roas: number | null;
};

export type PaymentBreakdownRow = {
  method: string;
  count: number;
  value: number;
};

export type HourlyRow = {
  hour: number;
  count: number;
};

export type RegionRow = {
  region: string;
  city: string | null;
  count: number;
};

export type ProductSalesRow = {
  productId: string;
  productName: string;
  count: number;
  value: number;
  pct: number;
};
