import type { SupabaseClient } from "@supabase/supabase-js";

import type { Offer } from "@/lib/types/offer";
import type {
  VisitorDetail,
  VisitorEventRow,
  VisitorLeadRow,
  VisitorSaleRow,
  VisitorStatus,
  VisitorSummaryRow,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deriveStatus(saleStatus: string | null, leadEmail: string | null): VisitorStatus {
  if (saleStatus === "refunded" || saleStatus === "chargeback") return "refunded";
  if (saleStatus === "approved") return "buyer";
  if (leadEmail) return "lead";
  return "visitor";
}

type RawSummaryRow = {
  visitor_id: string;
  offer_id: string;
  first_seen_at: string;
  last_seen_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  sale_status: string | null;
  sale_value: number | null;
  event_count: number;
  last_event_at: string | null;
};

export async function searchVisitors(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder do supabase-js
  supabase: any,
  params: { offerId: string | null; search: string; page: number; pageSize?: number },
  offers: Offer[],
): Promise<{ rows: VisitorSummaryRow[]; total: number }> {
  const pageSize = params.pageSize ?? 25;
  const offerNameById = new Map(offers.map((o) => [o.id, o.name]));

  let query = supabase.from("visitor_summary").select("*", { count: "exact" });

  if (params.offerId) {
    query = query.eq("offer_id", params.offerId);
  }

  const term = params.search.trim().replace(/[,()]/g, "");
  if (term) {
    const orFilters = [`lead_name.ilike.%${term}%`, `lead_email.ilike.%${term}%`, `lead_phone.ilike.%${term}%`];
    if (UUID_RE.test(term)) {
      orFilters.push(`visitor_id.eq.${term}`);
    }
    query = query.or(orFilters.join(","));
  }

  const from = (params.page - 1) * pageSize;
  const { data, count } = await query
    .order("last_seen_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const rows = ((data as RawSummaryRow[] | null) ?? []).map((row) => ({
    visitorId: row.visitor_id,
    offerId: row.offer_id,
    offerName: offerNameById.get(row.offer_id) ?? row.offer_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    city: row.city,
    region: row.region,
    country: row.country,
    leadName: row.lead_name,
    leadEmail: row.lead_email,
    leadPhone: row.lead_phone,
    saleStatus: row.sale_status,
    saleValue: row.sale_value,
    eventCount: row.event_count,
    lastEventAt: row.last_event_at,
    status: deriveStatus(row.sale_status, row.lead_email),
  }));

  return { rows, total: count ?? rows.length };
}

export async function getVisitorProfile(
  supabase: SupabaseClient,
  visitorId: string,
): Promise<{
  visitor: VisitorDetail | null;
  events: VisitorEventRow[];
  sales: VisitorSaleRow[];
  leads: VisitorLeadRow[];
}> {
  const [visitorRes, eventsRes, salesRes, leadsRes] = await Promise.all([
    supabase.from("visitors").select("*").eq("id", visitorId).maybeSingle(),
    supabase.from("events").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }),
    supabase.from("sales").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }),
    supabase.from("leads").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }),
  ]);

  return {
    visitor: (visitorRes.data as VisitorDetail | null) ?? null,
    events: (eventsRes.data as VisitorEventRow[] | null) ?? [],
    sales: (salesRes.data as VisitorSaleRow[] | null) ?? [],
    leads: (leadsRes.data as VisitorLeadRow[] | null) ?? [],
  };
}
