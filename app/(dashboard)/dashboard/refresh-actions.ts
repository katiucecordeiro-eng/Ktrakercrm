"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { syncAllOffers } from "@/lib/meta/sync-ad-spend";

// Botão "Atualizar" da Visão Geral: vendas/eventos da Hotmart já chegam em
// tempo real via webhook, mas gasto/cliques/impressões da Meta só mudam
// quando alguém sincroniza — resincroniza os últimos 3 dias (mesma janela
// do cron diário) antes de revalidar a página, pra "Atualizar" realmente
// trazer números novos em vez de só reler o banco.
export async function refreshDashboardDataAction() {
  if (!isSupabaseConfigured()) return;

  const until = new Date().toISOString().slice(0, 10);
  const since = new Date();
  since.setDate(since.getDate() - 3);

  const supabase = await createClient();
  await syncAllOffers(supabase, since.toISOString().slice(0, 10), until);

  revalidatePath("/dashboard");
}
