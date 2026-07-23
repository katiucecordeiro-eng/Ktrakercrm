// Cliente da API de Vendas da Hotmart, usado só para o backfill manual de
// vendas retroativas (Configurações → Ofertas → "Sincronizar vendas
// Hotmart"). Endpoint e query params confirmados contra a documentação
// oficial (developers.hotmart.com/docs/pt-BR/v1/sales/sales-history/):
// product_id é `long` (7 dígitos — não o código do link de checkout),
// start_date/end_date em milissegundos, max_results/page_token pra
// paginação. O formato exato dos ITENS da resposta (nomes de campo dentro
// de cada venda) não pôde ser confirmado contra uma resposta real neste
// ambiente — os extratores assumem os mesmos caminhos (`purchase.*`,
// `buyer.*`, `product.*`) do webhook, reaproveitados de
// `lib/hotmart/extract.ts`. O payload bruto de cada item fica em
// `sales.raw_payload` para conferência caso algum campo não bata.

const TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const SALES_HISTORY_URL = "https://developers.hotmart.com/payments/api/v1/sales/history";

export type HotmartSalesHistoryItem = Record<string, unknown>;

type TokenResult = { accessToken?: string; error?: string };

// fetch + parse defensivo: nunca deixa `res.json()` estourar em cima de um
// corpo vazio/HTML (ex. 404 de host errado, gateway timeout) — sempre
// devolve o status HTTP e um trecho do corpo bruto no erro, pra dar pra
// diagnosticar qual etapa falhou sem precisar de acesso ao painel da
// Hotmart.
async function safeFetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; error?: string }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: {},
      error: `Falha de rede ao chamar a Hotmart: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: res.status,
        json: {},
        error: `HTTP ${res.status} — resposta não é JSON: ${text.slice(0, 300)}`,
      };
    }
  }

  return { ok: res.ok, status: res.status, json };
}

export async function getHotmartAccessToken(): Promise<TokenResult> {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  const basicToken = process.env.HOTMART_BASIC_TOKEN;

  if (!clientId || !clientSecret) {
    return { error: "HOTMART_CLIENT_ID/HOTMART_CLIENT_SECRET não configurados." };
  }
  if (!basicToken) {
    return { error: "HOTMART_BASIC_TOKEN não configurado." };
  }

  // O header Authorization: Basic já identifica o cliente sozinho — mandar
  // client_id/client_secret também na URL faz a Hotmart comparar os dois e
  // rejeitar com "Given client ID does not match authenticated client" se
  // não baterem exatamente. Client_id/secret continuam guardados (podem
  // servir pra outro fluxo/diagnóstico), mas não vão mais nessa chamada.
  const url = new URL(TOKEN_URL);
  url.searchParams.set("grant_type", "client_credentials");

  const cleanBasicToken = basicToken.replace(/^Basic\s+/i, "");
  const { ok, status, json, error } = await safeFetchJson(url.toString(), {
    method: "POST",
    headers: { Authorization: `Basic ${cleanBasicToken}` },
  });
  if (error) return { error };

  if (!ok) {
    const message = (json.error_description as string) ?? (json.error as string) ?? `HTTP ${status}`;
    return { error: `Falha ao autenticar na Hotmart: ${message}` };
  }

  const accessToken = json.access_token as string | undefined;
  if (!accessToken) return { error: "Resposta da Hotmart sem access_token." };
  return { accessToken };
}

type SalesHistoryResult = {
  items: HotmartSalesHistoryItem[];
  nextPageToken: string | null;
  error?: string;
};

// Busca uma página de vendas de um produto no período informado. O
// chamador é responsável por paginar (usar nextPageToken na chamada
// seguinte) e por iterar múltiplos product_id, se houver.
export async function fetchHotmartSalesHistory(params: {
  accessToken: string;
  productId: string;
  startDate: Date;
  endDate: Date;
  pageToken?: string;
}): Promise<SalesHistoryResult> {
  const url = new URL(SALES_HISTORY_URL);
  url.searchParams.set("product_id", params.productId);
  url.searchParams.set("start_date", String(params.startDate.getTime()));
  url.searchParams.set("end_date", String(params.endDate.getTime()));
  url.searchParams.set("max_results", "500");
  if (params.pageToken) url.searchParams.set("page_token", params.pageToken);

  const { ok, status, json, error } = await safeFetchJson(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (error) return { items: [], nextPageToken: null, error };

  if (!ok) {
    const message =
      (json.error_description as string) ??
      (json.message as string) ??
      (json.error as string) ??
      `HTTP ${status}`;
    const queryDebug = url.search;
    return {
      items: [],
      nextPageToken: null,
      error: `Falha ao buscar vendas (produto ${params.productId}): ${message} [query: ${queryDebug}]`,
    };
  }

  const items = (json.items as HotmartSalesHistoryItem[] | undefined) ?? [];
  const pageInfo = json.page_info as { next_page_token?: string } | undefined;

  return { items, nextPageToken: pageInfo?.next_page_token ?? null };
}

// Paginação completa para um único product_id, com limite de segurança
// contra loop infinito caso a API devolva um next_page_token repetido.
export async function fetchAllHotmartSalesForProduct(params: {
  accessToken: string;
  productId: string;
  startDate: Date;
  endDate: Date;
}): Promise<{ items: HotmartSalesHistoryItem[]; error?: string }> {
  const items: HotmartSalesHistoryItem[] = [];
  let pageToken: string | undefined;
  let guard = 0;

  while (guard < 50) {
    guard += 1;
    const page = await fetchHotmartSalesHistory({ ...params, pageToken });
    if (page.error) return { items, error: page.error };

    items.push(...page.items);
    if (!page.nextPageToken || page.nextPageToken === pageToken) break;
    pageToken = page.nextPageToken;
  }

  return { items };
}
