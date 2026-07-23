"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Offer } from "@/lib/types/offer";

export type TrackTestState =
  | { success?: string; error?: string; offerSlug?: string; offerActive?: boolean }
  | undefined;

async function getOffer(offerId: string): Promise<Offer | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
  return (data as Offer | null) ?? null;
}

// Dispara um evento sintético pelo MESMO caminho que o track.js usa
// (POST em /api/track), pra confirmar se o endpoint aceita eventos para o
// slug testado — sem precisar de acesso à página ao vivo ou ao banco.
// Usa event_name "DiagnosticPing" (fora da lista PageView/ViewContent/
// AddToCart/InitiateCheckout/Purchase) pra não poluir funil nem KPIs; o
// evento cru fica visível no log de eventos ao vivo como confirmação extra.
export async function testTrackIngestion(
  offerId: string,
  _prevState: TrackTestState,
  formData: FormData,
): Promise<TrackTestState> {
  if (!isSupabaseConfigured()) return { error: "Supabase não configurado." };

  const offer = await getOffer(offerId);
  if (!offer) return { error: "Oferta não encontrada." };

  const slugTested = String(formData.get("slug") ?? offer.slug).trim();
  if (!slugTested) return { error: "Informe o slug a testar." };

  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    return { error: "Não foi possível determinar a URL base do app para o teste." };
  }

  try {
    const res = await fetch(`${baseUrl}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offer_slug: slugTested,
        visitor_id: crypto.randomUUID(),
        event_id: crypto.randomUUID(),
        event_name: "DiagnosticPing",
      }),
    });

    const json = await res.json().catch(() => ({}) as Record<string, unknown>);

    if (res.status === 404) {
      return {
        error: `A oferta com slug "${slugTested}" não foi encontrada como ATIVA. Confirme que esse valor bate exatamente com o data-offer da página (maiúsculas/minúsculas não importam mais, mas espaços e caracteres extras sim) e que "Oferta ativa" está ligado.`,
        offerSlug: offer.slug,
        offerActive: offer.active,
      };
    }
    if (res.status === 429) {
      return { error: "Rate limit — aguarde alguns segundos e tente de novo." };
    }
    if (!res.ok) {
      return {
        error: `Falha inesperada (HTTP ${res.status}): ${JSON.stringify(json)}`,
        offerSlug: offer.slug,
        offerActive: offer.active,
      };
    }

    return {
      success:
        "Sucesso! O endpoint aceitou o evento pelo mesmo caminho que o site usa. Se o funil real da página continuar zerado, o problema está em como o <script> é carregado na página ao vivo (ex.: injetado via JavaScript em vez de tag estática HTML) — abra o DevTools da página → aba Network → recarregue → procure uma chamada para /api/track.",
      offerSlug: offer.slug,
      offerActive: offer.active,
    };
  } catch (error) {
    return {
      error: `Falha de rede ao chamar /api/track: ${error instanceof Error ? error.message : String(error)}`,
      offerSlug: offer.slug,
      offerActive: offer.active,
    };
  }
}
