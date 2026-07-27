export type LeadMaturityStage = "frio" | "morno" | "quente" | "comprador" | "embaixador";

export const LEAD_MATURITY_LABELS: Record<LeadMaturityStage, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
  comprador: "Comprador",
  embaixador: "Embaixador",
};

export type HotVisitorRow = {
  visitorId: string;
  leadName: string | null;
  leadEmail: string | null;
  utmSource: string | null;
  lastSeenAt: string;
};

export type LeadMaturityResult = {
  distribution: { stage: LeadMaturityStage; count: number }[];
  hotVisitors: HotVisitorRow[];
};

type VisitorSummaryRow = {
  visitor_id: string;
  offer_id: string;
  last_seen_at: string;
  utm_source: string | null;
  lead_name: string | null;
  lead_email: string | null;
  sale_status: string | null;
};

// Classificação de maturidade não é baseada em período selecionado (é o
// estado atual da jornada, não uma métrica de um recorte de datas) — só
// escopada pela oferta, igual ao restante do CRM.
export async function getLeadMaturity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder do supabase-js
  supabase: any,
  offerId: string | null,
): Promise<LeadMaturityResult> {
  let visitorQuery = supabase
    .from("visitor_summary")
    .select("visitor_id, offer_id, last_seen_at, utm_source, lead_name, lead_email, sale_status");
  if (offerId) visitorQuery = visitorQuery.eq("offer_id", offerId);

  let eventsQuery = supabase.from("events").select("visitor_id, event_name, created_at");
  if (offerId) eventsQuery = eventsQuery.eq("offer_id", offerId);

  let salesQuery = supabase.from("sales").select("visitor_id, approved_at").eq("status", "approved");
  if (offerId) salesQuery = salesQuery.eq("offer_id", offerId);

  const [{ data: visitorRows }, { data: eventRows }, { data: saleRows }] = await Promise.all([
    visitorQuery,
    eventsQuery,
    salesQuery,
  ]);

  const visitDatesByVisitor = new Map<string, Set<string>>();
  const hasCheckoutByVisitor = new Set<string>();
  const lastPageviewAtByVisitor = new Map<string, string>();

  for (const row of (eventRows as { visitor_id: string; event_name: string; created_at: string }[] | null) ?? []) {
    if (row.event_name === "PageView") {
      const dates = visitDatesByVisitor.get(row.visitor_id) ?? new Set<string>();
      dates.add(row.created_at.slice(0, 10));
      visitDatesByVisitor.set(row.visitor_id, dates);

      const current = lastPageviewAtByVisitor.get(row.visitor_id);
      if (!current || row.created_at > current) lastPageviewAtByVisitor.set(row.visitor_id, row.created_at);
    }
    if (row.event_name === "InitiateCheckout") {
      hasCheckoutByVisitor.add(row.visitor_id);
    }
  }

  const approvedAtByVisitor = new Map<string, string>();
  for (const row of (saleRows as { visitor_id: string | null; approved_at: string | null }[] | null) ?? []) {
    if (!row.visitor_id || !row.approved_at) continue;
    const current = approvedAtByVisitor.get(row.visitor_id);
    if (!current || row.approved_at > current) approvedAtByVisitor.set(row.visitor_id, row.approved_at);
  }

  const distribution: Record<LeadMaturityStage, number> = {
    frio: 0,
    morno: 0,
    quente: 0,
    comprador: 0,
    embaixador: 0,
  };
  const hotVisitors: HotVisitorRow[] = [];

  for (const row of (visitorRows as VisitorSummaryRow[] | null) ?? []) {
    const approvedAt = approvedAtByVisitor.get(row.visitor_id);
    const lastPageviewAt = lastPageviewAtByVisitor.get(row.visitor_id);
    const isBuyer = row.sale_status === "approved" || Boolean(approvedAt);

    let stage: LeadMaturityStage;
    if (isBuyer && approvedAt && lastPageviewAt && lastPageviewAt > approvedAt) {
      stage = "embaixador";
    } else if (isBuyer) {
      stage = "comprador";
    } else if (hasCheckoutByVisitor.has(row.visitor_id)) {
      stage = "quente";
    } else if ((visitDatesByVisitor.get(row.visitor_id)?.size ?? 0) >= 2) {
      stage = "morno";
    } else {
      stage = "frio";
    }

    distribution[stage] += 1;

    if (stage === "quente") {
      hotVisitors.push({
        visitorId: row.visitor_id,
        leadName: row.lead_name,
        leadEmail: row.lead_email,
        utmSource: row.utm_source,
        lastSeenAt: row.last_seen_at,
      });
    }
  }

  hotVisitors.sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));

  return {
    distribution: (Object.keys(distribution) as LeadMaturityStage[]).map((stage) => ({
      stage,
      count: distribution[stage],
    })),
    hotVisitors: hotVisitors.slice(0, 50),
  };
}
