import { formatMetaApiError } from "./error";

const META_API_VERSION = "v21.0";

export type MetaInsightRow = {
  date: string;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string;
  adset_name: string | null;
  ad_id: string;
  ad_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number | null;
  metaInitiateCheckout: number;
};

type MetaInsightsResult = { rows: MetaInsightRow[]; error?: string };

function normalizeAdAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

// A Meta não tem um único nome fixo pra "InitiateCheckout" no campo
// `actions` — varia conforme a origem do evento (pixel padrão vs. CAPI,
// pixel novo vs. legado). Soma qualquer action_type conhecido pra evitar
// contar zero por só ter tentado o nome errado; não pôde ser confirmado
// contra uma resposta real de uma conta com CAPI configurado.
const INITIATE_CHECKOUT_ACTION_TYPES = [
  "initiate_checkout",
  "omni_initiated_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
];

function extractInitiateCheckout(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const action of actions as Record<string, unknown>[]) {
    const type = action.action_type as string | undefined;
    if (type && INITIATE_CHECKOUT_ACTION_TYPES.includes(type)) {
      total += Number(action.value ?? 0);
    }
  }
  return total;
}

// Busca os Insights da Meta Marketing API no nível de anúncio, com
// granularidade diária, paginando todos os resultados do período.
export async function fetchMetaInsights(params: {
  adAccountId: string;
  since: string;
  until: string;
  accessToken: string;
}): Promise<MetaInsightsResult> {
  const token = params.accessToken;
  if (!token) {
    return { rows: [], error: "Token da Marketing API não configurado para esta oferta" };
  }

  const fields = [
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "spend",
    "impressions",
    "clicks",
    "reach",
    "frequency",
    "actions",
    "date_start",
  ].join(",");

  const url = new URL(
    `https://graph.facebook.com/${META_API_VERSION}/${normalizeAdAccountId(params.adAccountId)}/insights`,
  );
  url.searchParams.set("level", "ad");
  url.searchParams.set("fields", fields);
  url.searchParams.set("time_range", JSON.stringify({ since: params.since, until: params.until }));
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", token);

  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null = url.toString();
  let guard = 0;

  try {
    while (nextUrl && guard < 50) {
      guard += 1;
      const res: Response = await fetch(nextUrl);
      const json: Record<string, unknown> = await res.json();

      if (!res.ok) {
        return { rows, error: formatMetaApiError(json, res.status) };
      }

      for (const item of (json.data ?? []) as Record<string, unknown>[]) {
        rows.push({
          date: String(item.date_start ?? params.since),
          campaign_id: String(item.campaign_id ?? ""),
          campaign_name: (item.campaign_name as string) ?? null,
          adset_id: String(item.adset_id ?? ""),
          adset_name: (item.adset_name as string) ?? null,
          ad_id: String(item.ad_id ?? ""),
          ad_name: (item.ad_name as string) ?? null,
          spend: Number(item.spend ?? 0),
          impressions: Number(item.impressions ?? 0),
          clicks: Number(item.clicks ?? 0),
          reach: Number(item.reach ?? 0),
          frequency: item.frequency != null ? Number(item.frequency) : null,
          metaInitiateCheckout: extractInitiateCheckout(item.actions),
        });
      }

      const paging = json.paging as { next?: string } | undefined;
      nextUrl = paging?.next ?? null;
    }

    return { rows };
  } catch (error) {
    return { rows, error: error instanceof Error ? error.message : String(error) };
  }
}
