const META_API_VERSION = "v21.0";

// Busca o thumbnail do criativo de vários anúncios numa única chamada
// (endpoint multi-ID da Graph API: GET /?ids=a,b,c). Não pôde ser validado
// contra uma conta real neste ambiente — se algum ad_id não tiver
// thumbnail (ex. anúncio deletado/arquivado), a Graph API só omite a
// chave, tratado aqui como "sem preview" em vez de erro.
export async function fetchAdThumbnails(
  adIds: string[],
  accessToken: string,
): Promise<Record<string, string | null>> {
  if (adIds.length === 0) return {};

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/`);
  url.searchParams.set("ids", adIds.join(","));
  url.searchParams.set("fields", "creative{thumbnail_url}");
  url.searchParams.set("access_token", accessToken);

  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as Record<string, { creative?: { thumbnail_url?: string } } | undefined>;
    if (!res.ok) return {};

    const result: Record<string, string | null> = {};
    for (const id of adIds) {
      result[id] = json[id]?.creative?.thumbnail_url ?? null;
    }
    return result;
  } catch {
    return {};
  }
}
