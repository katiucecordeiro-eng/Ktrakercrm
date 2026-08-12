import { formatMetaApiError } from "./error";

const META_API_VERSION = "v21.0";

export type MetaWriteResult = { ok: true } | { ok: false; error: string };

// Mesma lista de moedas sem casas decimais usada em account-info.ts — a
// Graph API espera (e devolve) valores monetários na menor unidade da
// moeda da conta, não no valor "de exibição".
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "PYG", "UGX"]);

export function toMinorUnits(value: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? Math.round(value) : Math.round(value * 100);
}

async function postToGraphApi(
  entityId: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<MetaWriteResult> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${entityId}`;
  const body = new URLSearchParams({ ...params, access_token: accessToken });

  try {
    const res = await fetch(url, { method: "POST", body });
    const json: Record<string, unknown> = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: formatMetaApiError(json, res.status) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Pausar/ativar funciona igual pra campanha, conjunto e anúncio — os 3
// níveis de objeto da Marketing API aceitam o mesmo campo `status`.
export async function setMetaEntityStatus(params: {
  entityId: string;
  status: "ACTIVE" | "PAUSED";
  accessToken: string;
}): Promise<MetaWriteResult> {
  if (!params.accessToken) {
    return { ok: false, error: "Token da Marketing API não configurado para esta oferta" };
  }
  return postToGraphApi(params.entityId, { status: params.status }, params.accessToken);
}

// Orçamento diário só existe em campanha (quando ela usa orçamento no
// nível de campanha, CBO) ou em conjunto (ABO) — nunca em anúncio. Se o
// nível errado for usado (ex. tentar setar orçamento de conjunto numa
// campanha CBO), a própria Meta rejeita com uma mensagem explicando; essa
// mensagem é repassada pra usuária tal como veio, sem tentar adivinhar.
export async function setMetaDailyBudget(params: {
  entityId: string;
  dailyBudgetMajorUnits: number;
  currency: string;
  accessToken: string;
}): Promise<MetaWriteResult> {
  if (!params.accessToken) {
    return { ok: false, error: "Token da Marketing API não configurado para esta oferta" };
  }
  const minorUnits = toMinorUnits(params.dailyBudgetMajorUnits, params.currency);
  return postToGraphApi(params.entityId, { daily_budget: String(minorUnits) }, params.accessToken);
}
