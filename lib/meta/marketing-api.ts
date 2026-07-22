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
};

type MetaInsightsResult = { rows: MetaInsightRow[]; error?: string };

function normalizeAdAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
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
        const apiError = json.error as { message?: string } | undefined;
        return { rows, error: apiError?.message ?? `HTTP ${res.status}` };
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
