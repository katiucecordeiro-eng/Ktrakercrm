"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { syncOfferAdSpend } from "@/lib/meta/sync-ad-spend";
import type { Offer } from "@/lib/types/offer";

export type SyncActionState = { error?: string; success?: string } | undefined;

export async function syncOfferAdSpendAction(
  offerId: string,
  _prevState: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
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

  if (!(offer as Offer).meta_ad_account_id) {
    return { error: "Cadastre o Meta Ad Account ID da oferta antes de sincronizar." };
  }

  const result = await syncOfferAdSpend(supabase, offer as Offer, since, until);
  revalidatePath("/dashboard/settings/offers");

  if (result.error) {
    return { error: result.error };
  }

  return { success: `${result.rows ?? 0} linha(s) de gasto sincronizada(s).` };
}
