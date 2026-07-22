"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { offerFormSchema, offerIdSchema } from "@/lib/validations/offer";

export type OfferActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  return offerFormSchema.safeParse(Object.fromEntries(formData));
}

export async function createOffer(
  _prevState: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não configurado. Defina as variáveis de ambiente primeiro." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("offers").insert(parsed.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings/offers");
  return { success: true };
}

export async function updateOffer(
  offerId: string,
  _prevState: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não configurado. Defina as variáveis de ambiente primeiro." };
  }

  const idResult = offerIdSchema.safeParse(offerId);
  const parsed = parseForm(formData);
  if (!idResult.success || !parsed.success) {
    return { error: parsed.success ? "ID de oferta inválido" : parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("offers")
    .update(parsed.data)
    .eq("id", idResult.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings/offers");
  return { success: true };
}
