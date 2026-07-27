"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type CampaignMappingActionState = { error?: string; success?: boolean } | undefined;

const createMappingSchema = z.object({
  offer_id: z.string().uuid(),
  raw_utm_campaign: z.string().trim().min(1, "Informe o utm_campaign bruto usado no anúncio"),
  campaign_id: z.string().trim().min(1, "Selecione a campanha real"),
  campaign_name: z.string().trim().optional().or(z.literal("")),
});

export async function createCampaignMapping(
  _prevState: CampaignMappingActionState,
  formData: FormData,
): Promise<CampaignMappingActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não configurado." };
  }

  const parsed = createMappingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("campaign_utm_mappings").insert({
    offer_id: parsed.data.offer_id,
    raw_utm_campaign: parsed.data.raw_utm_campaign,
    campaign_id: parsed.data.campaign_id,
    campaign_name: parsed.data.campaign_name || null,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "Já existe um mapeamento para esse utm_campaign nessa oferta." : error.message,
    };
  }

  revalidatePath("/dashboard/settings/offers");
  return { success: true };
}

export async function deleteCampaignMapping(mappingId: string): Promise<CampaignMappingActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não configurado." };
  }
  const idResult = z.string().uuid().safeParse(mappingId);
  if (!idResult.success) {
    return { error: "ID de mapeamento inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("campaign_utm_mappings").delete().eq("id", idResult.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings/offers");
  return { success: true };
}
