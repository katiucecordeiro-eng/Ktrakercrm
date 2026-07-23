"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { syncOfferSalesHistory } from "@/lib/hotmart/sync-sales";
import type { Offer } from "@/lib/types/offer";

export type HotmartSyncActionState = { error?: string; success?: string } | undefined;

export async function syncOfferSalesHistoryAction(
  offerId: string,
  _prevState: HotmartSyncActionState,
  formData: FormData,
): Promise<HotmartSyncActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não configurado." };
  }

  const since = String(formData.get("since") ?? "");
  const until = String(formData.get("until") ?? "");
  if (!since || !until) {
    return { error: "Informe o período (de/até)." };
  }

  const supabase = await createClient();
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .single();

  if (offerError || !offer) {
    return { error: "Oferta não encontrada." };
  }

  const result = await syncOfferSalesHistory(
    supabase,
    offer as Offer,
    new Date(`${since}T00:00:00Z`),
    new Date(`${until}T23:59:59Z`),
  );
  revalidatePath("/dashboard/settings/offers");
  revalidatePath("/dashboard");

  if (result.error) {
    return { error: result.error };
  }

  return {
    success: `${result.imported} venda(s) importada(s)${result.skipped > 0 ? `, ${result.skipped} ignorada(s)` : ""}.`,
  };
}
