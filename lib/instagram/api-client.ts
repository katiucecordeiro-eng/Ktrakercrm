import { formatMetaApiError } from "@/lib/meta/error";

const GRAPH_API_VERSION = "v21.0";

export type InstagramPost = {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  reach: number;
  impressions: number;
  saved: number;
  engagementRate: number | null;
};

type InstagramPostsResult = { posts: InstagramPost[]; error?: string };

// A Instagram Graph API varia as métricas de insight suportadas por tipo
// de mídia (feed comum vs. Reels) e já depreciou `impressions` para alguns
// tipos — não pôde ser validado ao vivo neste ambiente (sem acesso de rede
// aos domínios da Meta). Se a chamada de insights falhar para um post
// específico, ele entra na lista com métricas zeradas em vez de derrubar
// o lote inteiro.
async function fetchPostInsights(
  mediaId: string,
  accessToken: string,
): Promise<{ reach: number; impressions: number; saved: number }> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}/insights`);
  url.searchParams.set("metric", "reach,impressions,saved");
  url.searchParams.set("access_token", accessToken);

  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      data?: { name: string; values: { value: number }[] }[];
    };
    if (!res.ok) return { reach: 0, impressions: 0, saved: 0 };

    const byName = new Map((json.data ?? []).map((entry) => [entry.name, entry.values?.[0]?.value ?? 0]));
    return {
      reach: byName.get("reach") ?? 0,
      impressions: byName.get("impressions") ?? 0,
      saved: byName.get("saved") ?? 0,
    };
  } catch {
    return { reach: 0, impressions: 0, saved: 0 };
  }
}

export async function fetchInstagramPosts(params: {
  businessAccountId: string;
  accessToken: string;
  limit?: number;
}): Promise<InstagramPostsResult> {
  const limit = params.limit ?? 30;
  const fields = ["id", "caption", "media_type", "media_url", "thumbnail_url", "permalink", "timestamp", "like_count", "comments_count"].join(",");

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.businessAccountId}/media`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", params.accessToken);

  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { posts: [], error: formatMetaApiError(json, res.status) };
    }

    const items = (json.data ?? []) as Record<string, unknown>[];
    const posts = await Promise.all(
      items.map(async (item) => {
        const id = String(item.id);
        const insights = await fetchPostInsights(id, params.accessToken);
        const engagementSignals = Number(item.like_count ?? 0) + Number(item.comments_count ?? 0) + insights.saved;
        return {
          id,
          caption: (item.caption as string) ?? null,
          mediaType: String(item.media_type ?? "IMAGE"),
          mediaUrl: (item.media_url as string) ?? null,
          thumbnailUrl: (item.thumbnail_url as string) ?? (item.media_url as string) ?? null,
          permalink: (item.permalink as string) ?? null,
          timestamp: String(item.timestamp ?? new Date().toISOString()),
          likeCount: Number(item.like_count ?? 0),
          commentsCount: Number(item.comments_count ?? 0),
          reach: insights.reach,
          impressions: insights.impressions,
          saved: insights.saved,
          engagementRate: insights.reach > 0 ? (engagementSignals / insights.reach) * 100 : null,
        };
      }),
    );

    return { posts };
  } catch (error) {
    return { posts: [], error: error instanceof Error ? error.message : String(error) };
  }
}
