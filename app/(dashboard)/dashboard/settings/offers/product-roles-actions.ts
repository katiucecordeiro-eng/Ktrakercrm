"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type ProductRolesActionState = { error?: string; success?: string } | undefined;

const VALID_ROLES = new Set(["principal", "order_bump", "upsell", "downsell", "none"]);

// Salva todos os papéis de uma vez (um select por produto no formulário) —
// mais simples que uma action por linha, já que a lista de produtos de
// uma oferta costuma ser pequena (produto principal + poucos order
// bumps/upsells).
export async function saveProductRoles(
  offerId: string,
  _prevState: ProductRolesActionState,
  formData: FormData,
): Promise<ProductRolesActionState> {
  if (!isSupabaseConfigured()) return { error: "Supabase não configurado." };

  const productIds = formData.getAll("product_id").map(String);
  const roles = formData.getAll("role").map(String);

  if (productIds.length !== roles.length) {
    return { error: "Formulário inválido." };
  }

  for (const role of roles) {
    if (!VALID_ROLES.has(role)) return { error: `Papel inválido: ${role}` };
  }

  try {
    const supabase = await createClient();

    const toUpsert = productIds
      .map((productId, i) => ({ productId, role: roles[i] }))
      .filter((r) => r.role !== "none");
    const toDelete = productIds.filter((_, i) => roles[i] === "none");

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("offer_product_roles").upsert(
        toUpsert.map((r) => ({ offer_id: offerId, hotmart_product_id: r.productId, role: r.role })),
        { onConflict: "offer_id,hotmart_product_id" },
      );
      if (error) return { error: error.message };
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("offer_product_roles")
        .delete()
        .eq("offer_id", offerId)
        .in("hotmart_product_id", toDelete);
      if (error) return { error: error.message };
    }

    revalidatePath("/dashboard/settings/offers");
    revalidatePath("/dashboard");
    return { success: "Papéis dos produtos salvos." };
  } catch (error) {
    console.error("[product-roles-actions] saveProductRoles", error);
    return { error: error instanceof Error ? error.message : "Falha inesperada." };
  }
}
