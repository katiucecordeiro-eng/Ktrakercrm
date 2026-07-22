"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { offerFormSchema, offerIdSchema, type OfferFormValues } from "@/lib/validations/offer";
import { encryptSecret } from "@/lib/crypto/secrets";

export type OfferActionState = { error?: string; success?: boolean } | undefined;

const SECRET_FIELDS = ["meta_capi_token", "meta_ads_token", "ga4_api_secret"] as const;

function parseForm(formData: FormData) {
  return offerFormSchema.safeParse(Object.fromEntries(formData));
}

// Criação: campo de token vazio vira null (nada configurado ainda).
function prepareForInsert(data: OfferFormValues) {
  const row: Record<string, unknown> = { ...data };
  for (const field of SECRET_FIELDS) {
    const value = data[field];
    row[field] = value ? encryptSecret(value) : null;
  }
  return row;
}

// Edição: campo de token vazio significa "não mexeu" — omite a coluna do
// update para não sobrescrever o token já salvo com null. Só grava um valor
// novo quando o usuário realmente colou algo no campo.
function prepareForUpdate(data: OfferFormValues) {
  const row: Record<string, unknown> = { ...data };
  for (const field of SECRET_FIELDS) {
    const value = data[field];
    if (value) {
      row[field] = encryptSecret(value);
    } else {
      delete row[field];
    }
  }
  return row;
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

  let row: Record<string, unknown>;
  try {
    row = prepareForInsert(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao criptografar tokens" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("offers").insert(row);
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

  let row: Record<string, unknown>;
  try {
    row = prepareForUpdate(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao criptografar tokens" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("offers").update(row).eq("id", idResult.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings/offers");
  return { success: true };
}
