// Cliente da API de Vendas da Hotmart, usado só para o backfill manual de
// vendas retroativas (Configurações → Ofertas → "Sincronizar vendas
// Hotmart"). Igual ao webhook, o formato exato da resposta não pôde ser
// confirmado contra a documentação ao vivo neste ambiente — os itens
// retornados usam os mesmos caminhos (`purchase.*`, `buyer.*`, `product.*`)
// dos extratores de `lib/hotmart/extract.ts`, reaproveitados aqui. O
// payload bruto de cada item fica em `sales.raw_payload` para conferência.

const TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const SALES_HISTORY_URL = "https://developers.hotmart.com/payments/api/v1/sales/history";

export type HotmartSalesHistoryItem = Record<string, unknown>;

type TokenResult = { accessToken?: string; error?: string };

export async function getHotmartAccessToken(): Promise<TokenResult> {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "HOTMART_CLIENT_ID/HOTMART_CLIENT_SECRET não configurados." };
  }

  const url = new URL(TOKEN_URL);
  url.searchParams.set("grant_type", "client_credentials");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);

  try {
    const res = await fetch(url.toString(), { method: "POST" });
    const json: Record<string, unknown> = await res.json();

    if (!res.ok) {
      const message = (json.error_description as string) ?? (json.error as string) ?? `HTTP ${res.status}`;
      return { error: message };
    }

    const accessToken = json.access_token as string | undefined;
    if (!accessToken) return { error: "Resposta da Hotmart sem access_token." };
    return { accessToken };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
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

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    const json: Record<string, unknown> = await res.json();

    if (!res.ok) {
      const message = (json.error_description as string) ?? (json.message as string) ?? `HTTP ${res.status}`;
      return { items: [], nextPageToken: null, error: message };
    }

    const items = (json.items as HotmartSalesHistoryItem[] | undefined) ?? [];
    const pageInfo = json.page_info as { next_page_token?: string } | undefined;

    return { items, nextPageToken: pageInfo?.next_page_token ?? null };
  } catch (error) {
    return {
      items: [],
      nextPageToken: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
