"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/profile";

export type DecisaoState = { error?: string; success?: boolean } | undefined;

const vincularSchema = z.object({
  solicitacaoId: z.string().uuid(),
  itemId: z.string().uuid("Selecione um item do catálogo para vincular."),
  motivo: z.string().trim().max(2000).optional(),
});

export async function vincularItemExistente(
  _prevState: DecisaoState,
  formData: FormData,
): Promise<DecisaoState> {
  const profile = await requireRole("suprimentos");

  const parsed = vincularSchema.safeParse({
    solicitacaoId: formData.get("solicitacaoId"),
    itemId: formData.get("itemId"),
    motivo: formData.get("motivo") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { solicitacaoId, itemId, motivo } = parsed.data;

  const { error: updateError } = await supabase
    .from("solicitacoes")
    .update({
      status: "vinculado",
      item_vinculado_id: itemId,
      data_resposta: new Date().toISOString(),
      responsavel_suprimentos_id: profile.id,
    })
    .eq("id", solicitacaoId);

  if (updateError) {
    return { error: "Não foi possível vincular a solicitação. Tente novamente." };
  }

  const { error: logError } = await supabase.from("log_decisoes").insert({
    solicitacao_id: solicitacaoId,
    decisao: "vinculado_existente",
    motivo: motivo ?? null,
    responsavel_id: profile.id,
    item_id: itemId,
  });

  if (logError) {
    console.error("[frota] falha ao registrar log_decisoes (vincular)", logError);
  }

  revalidatePath("/fila");
  revalidatePath(`/solicitacoes/${solicitacaoId}`);
  return { success: true };
}

const aprovarSchema = z.object({
  solicitacaoId: z.string().uuid(),
  familiaId: z.string().uuid(),
  referenciaFabricante: z.string().trim().min(1),
  codigoBenner: z.string().trim().min(1, "Informe o código Benner do item recém-cadastrado."),
  nomePadronizado: z.string().trim().min(3, "Informe um nome padronizado válido."),
  ncmCest: z.string().trim().max(20).optional(),
  unidadeMedida: z.string().trim().min(1, "Informe a unidade de medida."),
  aplicacao: z.string().trim().optional(),
  lado: z.enum(["D", "E"]).optional(),
});

export async function aprovarComoNovo(
  _prevState: DecisaoState,
  formData: FormData,
): Promise<DecisaoState> {
  const profile = await requireRole("suprimentos");

  const parsed = aprovarSchema.safeParse({
    solicitacaoId: formData.get("solicitacaoId"),
    familiaId: formData.get("familiaId"),
    referenciaFabricante: formData.get("referenciaFabricante"),
    codigoBenner: formData.get("codigoBenner"),
    nomePadronizado: formData.get("nomePadronizado"),
    ncmCest: formData.get("ncmCest") || undefined,
    unidadeMedida: formData.get("unidadeMedida"),
    aplicacao: formData.get("aplicacao") || undefined,
    lado: formData.get("lado") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    solicitacaoId,
    familiaId,
    referenciaFabricante,
    codigoBenner,
    nomePadronizado,
    ncmCest,
    unidadeMedida,
    aplicacao,
    lado,
  } = parsed.data;

  const { data: novoItem, error: insertError } = await supabase
    .from("catalogo_padrao")
    .insert({
      codigo_benner: codigoBenner,
      nome_padronizado: nomePadronizado,
      familia_id: familiaId,
      referencia_fabricante_principal: referenciaFabricante,
      ncm_cest: ncmCest ?? null,
      atributos_json: { aplicacao: aplicacao ?? null, lado: lado ?? null, unidade_medida: unidadeMedida },
    })
    .select("id")
    .single();

  if (insertError || !novoItem) {
    if (insertError?.code === "23505") {
      return { error: "Já existe um item no catálogo com esse código Benner." };
    }
    return { error: "Não foi possível cadastrar o item no catálogo padrão." };
  }

  const { error: updateError } = await supabase
    .from("solicitacoes")
    .update({
      status: "aprovado",
      item_vinculado_id: novoItem.id,
      data_resposta: new Date().toISOString(),
      responsavel_suprimentos_id: profile.id,
    })
    .eq("id", solicitacaoId);

  if (updateError) {
    return { error: "Item cadastrado, mas houve falha ao atualizar a solicitação." };
  }

  const { error: logError } = await supabase.from("log_decisoes").insert({
    solicitacao_id: solicitacaoId,
    decisao: "aprovado_novo",
    responsavel_id: profile.id,
    item_id: novoItem.id,
  });

  if (logError) {
    console.error("[frota] falha ao registrar log_decisoes (aprovar)", logError);
  }

  revalidatePath("/fila");
  revalidatePath(`/solicitacoes/${solicitacaoId}`);
  return { success: true };
}

const rejeitarSchema = z.object({
  solicitacaoId: z.string().uuid(),
  motivo: z.string().trim().min(5, "Explique o motivo da rejeição (mínimo 5 caracteres)."),
});

export async function rejeitarSolicitacao(
  _prevState: DecisaoState,
  formData: FormData,
): Promise<DecisaoState> {
  const profile = await requireRole("suprimentos");

  const parsed = rejeitarSchema.safeParse({
    solicitacaoId: formData.get("solicitacaoId"),
    motivo: formData.get("motivo"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { solicitacaoId, motivo } = parsed.data;

  const { error: updateError } = await supabase
    .from("solicitacoes")
    .update({
      status: "rejeitado",
      data_resposta: new Date().toISOString(),
      responsavel_suprimentos_id: profile.id,
    })
    .eq("id", solicitacaoId);

  if (updateError) {
    return { error: "Não foi possível rejeitar a solicitação. Tente novamente." };
  }

  const { error: logError } = await supabase.from("log_decisoes").insert({
    solicitacao_id: solicitacaoId,
    decisao: "rejeitado",
    motivo,
    responsavel_id: profile.id,
  });

  if (logError) {
    console.error("[frota] falha ao registrar log_decisoes (rejeitar)", logError);
  }

  revalidatePath("/fila");
  revalidatePath(`/solicitacoes/${solicitacaoId}`);
  return { success: true };
}

const marcarEmAnaliseSchema = z.object({ solicitacaoId: z.string().uuid() });

// Chamado pela própria página de detalhe ao ser aberta pela 1ª vez — sinaliza
// pra fila que alguém já está olhando essa solicitação. Não é uma ação do
// usuário (sem form/botão), por isso não usa useActionState.
export async function marcarEmAnalise(solicitacaoId: string) {
  const profile = await requireRole("suprimentos");
  const parsed = marcarEmAnaliseSchema.safeParse({ solicitacaoId });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("solicitacoes")
    .update({ status: "em_analise", responsavel_suprimentos_id: profile.id })
    .eq("id", solicitacaoId)
    .eq("status", "pendente");
}
