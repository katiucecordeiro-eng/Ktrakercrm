import { formatMetaApiError } from "./error";

const META_API_VERSION = "v21.0";

export type MetaAccountInfo = {
  currency: string;
  amountSpent: number;
  balance: number;
  spendCap: number | null;
};

type MetaAccountInfoResult = { data?: MetaAccountInfo; error?: string };

function normalizeAdAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

// Moedas sem casas decimais (convenção conhecida, ex. Stripe) — a Graph API
// retorna amount_spent/balance/spend_cap na menor unidade da moeda da conta
// (centavos, para a maioria); não foi possível confirmar isso contra uma
// conta real de outra moeda neste ambiente, então a lista cobre os casos
// mais comuns.
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "PYG", "UGX"]);

function toMajorUnits(value: number, currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? value : value / 100;
}

// Busca dados no nível da CONTA de anúncio (não por campanha/dia): total
// gasto historicamente e saldo/valor devido — usado para o usuário calcular
// um ROI "real" considerando o que já saiu de fato da conta, além do que os
// Insights (por campanha) mostram. A Graph API não expõe um campo separado
// de "impostos" no objeto da conta — isso só aparece no detalhamento de
// fatura do Gerenciador de Anúncios (Faturamento), fora do escopo da
// Marketing API.
export async function fetchMetaAccountInfo(params: {
  adAccountId: string;
  accessToken: string;
}): Promise<MetaAccountInfoResult> {
  if (!params.accessToken) {
    return { error: "Token da Marketing API não configurado para esta oferta" };
  }

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${normalizeAdAccountId(params.adAccountId)}`);
  url.searchParams.set("fields", "currency,amount_spent,balance,spend_cap");
  url.searchParams.set("access_token", params.accessToken);

  try {
    const res = await fetch(url.toString());
    const json: Record<string, unknown> = await res.json();

    if (!res.ok) {
      return { error: formatMetaApiError(json, res.status) };
    }

    const currency = String(json.currency ?? "BRL");
    const rawSpendCap = json.spend_cap != null ? Number(json.spend_cap) : null;

    return {
      data: {
        currency,
        amountSpent: toMajorUnits(Number(json.amount_spent ?? 0), currency),
        balance: toMajorUnits(Number(json.balance ?? 0), currency),
        spendCap: rawSpendCap != null ? toMajorUnits(rawSpendCap, currency) : null,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
