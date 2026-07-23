export type Granularity = "hour" | "day" | "week" | "month";

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
  spend: number;
  revenue: number;
  salesCount: number;
  clicks: number;
  impressions: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
};

export type CampaignRow = CampaignAdRow & {
  adsets: (CampaignAdRow & { ads: CampaignAdRow[] })[];
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
