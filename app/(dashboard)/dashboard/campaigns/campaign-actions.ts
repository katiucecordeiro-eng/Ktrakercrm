"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { resolveMetaAdsToken } from "@/lib/meta/sync-ad-spend";
import { setMetaDailyBudget, setMetaEntityStatus } from "@/lib/meta/campaign-actions";
import type { Offer } from "@/lib/types/offer";

export type CampaignActionState = { error?: string; success?: string } | undefined;

type Level = "campaign" | "adset" | "ad";

async function loadOffer(offerId: string): Promise<{ offer: Offer | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("offers").select("*").eq("id", offerId).single();
  if (error || !data) return { offer: null, error: "Oferta não encontrada." };
  return { offer: data as Offer };
}

async function logAction(params: {
  offerId: string;
  level: Level;
  entityId: string;
  entityName: string;
  action: "activate" | "pause" | "update_budget";
  detail?: string;
  success: boolean;
  error?: string;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("campaign_action_logs").insert({
      offer_id: params.offerId,
      level: params.level,
      entity_id: params.entityId,
      entity_name: params.entityName,
      action: params.action,
      detail: params.detail ?? null,
      success: params.success,
      error: params.error ?? null,
    });
  } catch (logError) {
    // Auditoria não pode derrubar a ação em si se o insert falhar.
    console.error("[campaign-actions] falha ao gravar campaign_action_logs", logError);
  }
}

// Pausar/ativar é sempre disparado com um clique só (sem precisar ler o
// status atual antes) — o campo `status` da Marketing API é idempotente,
// então clicar "Pausar" numa campanha já pausada simplesmente confirma o
// estado, sem efeito colateral.
export async function toggleCampaignStatusAction(
  offerId: string,
  level: Level,
  entityId: string,
  entityName: string,
  status: "ACTIVE" | "PAUSED",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState (é o último parâmetro aqui, sem formData depois)
  _prevState: CampaignActionState,
): Promise<CampaignActionState> {
  if (!isSupabaseConfigured()) return { error: "Supabase não configurado." };

  try {
    const { offer, error: offerError } = await loadOffer(offerId);
    if (!offer) return { error: offerError };

    const accessToken = resolveMetaAdsToken(offer);
    const result = await setMetaEntityStatus({ entityId, status, accessToken: accessToken ?? "" });

    await logAction({
      offerId,
      level,
      entityId,
      entityName,
      action: status === "ACTIVE" ? "activate" : "pause",
      success: result.ok,
      error: result.ok ? undefined : result.error,
    });

    if (!result.ok) return { error: result.error };

    revalidatePath("/dashboard/campaigns");
    return { success: `${entityName}: ${status === "ACTIVE" ? "ativado" : "pausado"} na Meta.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    console.error("[campaign-actions] toggleCampaignStatusAction", error);
    return { error: message };
  }
}

export async function updateCampaignBudgetAction(
  offerId: string,
  level: "campaign" | "adset",
  entityId: string,
  entityName: string,
  currency: string,
  _prevState: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  if (!isSupabaseConfigured()) return { error: "Supabase não configurado." };

  const rawBudget = String(formData.get("dailyBudget") ?? "").replace(",", ".");
  const dailyBudget = Number(rawBudget);
  if (!rawBudget || Number.isNaN(dailyBudget) || dailyBudget <= 0) {
    return { error: "Informe um orçamento diário válido." };
  }

  try {
    const { offer, error: offerError } = await loadOffer(offerId);
    if (!offer) return { error: offerError };

    const accessToken = resolveMetaAdsToken(offer);
    const result = await setMetaDailyBudget({
      entityId,
      dailyBudgetMajorUnits: dailyBudget,
      currency,
      accessToken: accessToken ?? "",
    });

    await logAction({
      offerId,
      level,
      entityId,
      entityName,
      action: "update_budget",
      detail: `novo orçamento diário: ${dailyBudget} ${currency}`,
      success: result.ok,
      error: result.ok ? undefined : result.error,
    });

    if (!result.ok) return { error: result.error };

    revalidatePath("/dashboard/campaigns");
    return { success: `${entityName}: orçamento diário atualizado na Meta.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    console.error("[campaign-actions] updateCampaignBudgetAction", error);
    return { error: message };
  }
}
