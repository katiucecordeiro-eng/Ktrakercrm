"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendMetaEvent } from "@/lib/meta/capi";
import { fetchMetaInsights } from "@/lib/meta/marketing-api";
import type { Offer } from "@/lib/types/offer";

export type TestActionState = { success?: string; error?: string } | undefined;

async function getOffer(offerId: string): Promise<Offer | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
  return (data as Offer | null) ?? null;
}

export async function testMetaCapi(
  offerId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: TestActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<TestActionState> {
  if (!isSupabaseConfigured()) return { error: "Supabase não configurado." };

  const offer = await getOffer(offerId);
  if (!offer) return { error: "Oferta não encontrada." };

  const result = await sendMetaEvent({
    offer,
    eventName: "PageView",
    eventId: `diagnostic-${Date.now()}`,
    eventTime: Math.floor(Date.now() / 1000),
    externalId: "diagnostic-test",
  });

  if (result.status === "skipped") {
    const reason = (result.response as { reason?: string } | null)?.reason;
    return { error: reason ?? "Pixel ID ou token CAPI não configurados." };
  }
  if (result.status === "failed") {
    const message = (result.response as { error?: string } | null)?.error;
    return { error: message ?? "Falha ao enviar evento de teste." };
  }

  return {
    success: "Evento de teste enviado! Confira no Gerenciador de Eventos (Test Events) da Meta.",
  };
}

export async function testMarketingApi(
  offerId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: TestActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<TestActionState> {
  if (!isSupabaseConfigured()) return { error: "Supabase não configurado." };

  const offer = await getOffer(offerId);
  if (!offer) return { error: "Oferta não encontrada." };
  if (!offer.meta_ad_account_id) {
    return { error: "Cadastre o Meta Ad Account ID desta oferta primeiro." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { rows, error } = await fetchMetaInsights({
    adAccountId: offer.meta_ad_account_id,
    since: today,
    until: today,
  });

  if (error) return { error };
  return { success: `Conectado! ${rows.length} linha(s) de Insights encontradas hoje.` };
}
