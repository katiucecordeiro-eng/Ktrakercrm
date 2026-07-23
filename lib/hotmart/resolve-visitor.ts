import type { SupabaseClient } from "@supabase/supabase-js";

// Casa uma venda com o visitante: por sck (visitor_id) primeiro, senão pelo
// e-mail do lead mais recente. Compartilhado pelo webhook em tempo real e
// pelo backfill de vendas históricas.
export async function resolveVisitor(
  supabase: SupabaseClient,
  sck: string | null,
  buyerEmail: string | null,
) {
  if (sck) {
    const { data } = await supabase.from("visitors").select("*").eq("id", sck).maybeSingle();
    if (data) return data;
  }

  if (buyerEmail) {
    const { data: lead } = await supabase
      .from("leads")
      .select("visitor_id")
      .eq("email", buyerEmail)
      .not("visitor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead?.visitor_id) {
      const { data: visitor } = await supabase
        .from("visitors")
        .select("*")
        .eq("id", lead.visitor_id)
        .maybeSingle();
      if (visitor) return visitor;
    }
  }

  return null;
}
