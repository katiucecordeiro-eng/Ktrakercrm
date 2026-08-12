import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReportFilters } from "./types";

export type ProductRole = "principal" | "order_bump" | "upsell" | "downsell";

export type ProductRoleRow = {
  productId: string;
  role: ProductRole;
};

export type ProductRoleMetric = {
  productId: string;
  productName: string | null;
  role: ProductRole;
  count: number;
  revenue: number;
  // % de vendas do produto principal que também compraram este produto —
  // aproximação por contagem no período, não um link de transação a
  // transação (ver ressalva em getOrderBumpUpsellMetrics).
  attachRatePct: number | null;
};

export type OrderBumpUpsellMetrics = {
  principalCount: number;
  principalRevenue: number;
  products: ProductRoleMetric[];
};

export async function getProductRoles(
  supabase: SupabaseClient,
  offerId: string,
): Promise<ProductRoleRow[]> {
  const { data } = await supabase
    .from("offer_product_roles")
    .select("hotmart_product_id, role")
    .eq("offer_id", offerId);
  return ((data as { hotmart_product_id: string; role: ProductRole }[] | null) ?? []).map((row) => ({
    productId: row.hotmart_product_id,
    role: row.role,
  }));
}

// Taxa de order bump/upsell como APROXIMAÇÃO: conta vendas por produto no
// período e divide pelo total do produto principal — não segue o link
// transação-a-transação da Hotmart (`order_bump.parent_purchase_transaction`,
// que não é capturado no schema atual). Suficiente pra "de cada 10 vendas
// do produto principal, quantas vieram com esse order bump/upsell", mas
// um order bump vendido sem o principal no mesmo período (raro) infla a
// taxa; documentar essa ressalva na UI.
export async function getOrderBumpUpsellMetrics(
  supabase: SupabaseClient,
  filters: ReportFilters,
): Promise<OrderBumpUpsellMetrics | null> {
  if (!filters.offerId) return null;

  const roles = await getProductRoles(supabase, filters.offerId);
  if (roles.length === 0) return null;

  const roleByProduct = new Map(roles.map((r) => [r.productId, r.role]));
  const productIds = roles.map((r) => r.productId);

  const { data } = await supabase
    .from("sales")
    .select("product_id, product_name, gross_value")
    .eq("offer_id", filters.offerId)
    .eq("status", "approved")
    .in("product_id", productIds)
    .gte("approved_at", filters.since.toISOString())
    .lte("approved_at", filters.until.toISOString());

  const rows = (data as { product_id: string; product_name: string | null; gross_value: number | null }[] | null) ?? [];

  const acc = new Map<string, { name: string | null; count: number; revenue: number }>();
  for (const row of rows) {
    const existing = acc.get(row.product_id) ?? { name: row.product_name, count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += Number(row.gross_value ?? 0);
    if (!existing.name && row.product_name) existing.name = row.product_name;
    acc.set(row.product_id, existing);
  }

  const principalIds = roles.filter((r) => r.role === "principal").map((r) => r.productId);
  const principalCount = principalIds.reduce((sum, id) => sum + (acc.get(id)?.count ?? 0), 0);
  const principalRevenue = principalIds.reduce((sum, id) => sum + (acc.get(id)?.revenue ?? 0), 0);

  const products: ProductRoleMetric[] = roles
    .filter((r) => r.role !== "principal")
    .map((r) => {
      const entry = acc.get(r.productId);
      return {
        productId: r.productId,
        productName: entry?.name ?? null,
        role: r.role,
        count: entry?.count ?? 0,
        revenue: entry?.revenue ?? 0,
        attachRatePct: principalCount > 0 ? ((entry?.count ?? 0) / principalCount) * 100 : null,
      };
    })
    .filter((p) => roleByProduct.get(p.productId) !== "principal");

  return { principalCount, principalRevenue, products };
}
