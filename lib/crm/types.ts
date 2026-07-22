export type VisitorStatus = "buyer" | "refunded" | "lead" | "visitor";

export type VisitorSummaryRow = {
  visitorId: string;
  offerId: string;
  offerName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  saleStatus: string | null;
  saleValue: number | null;
  eventCount: number;
  lastEventAt: string | null;
  status: VisitorStatus;
};

export type VisitorDetail = {
  id: string;
  offer_id: string;
  first_seen_at: string;
  last_seen_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  ga_client_id: string | null;
  referrer: string | null;
  landing_page: string | null;
  ip: string | null;
  user_agent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device_type: string | null;
};

export type VisitorEventRow = {
  id: string;
  event_name: string;
  event_id: string;
  page_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  meta_status: string;
  meta_response: unknown;
  ga4_status: string;
  created_at: string;
};

export type VisitorSaleRow = {
  id: string;
  hotmart_transaction_id: string;
  product_name: string | null;
  status: string;
  gross_value: number | null;
  currency: string;
  payment_method: string | null;
  approved_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export type VisitorLeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
};
