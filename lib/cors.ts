export function resolveCorsOrigin(
  origin: string | null,
  domain: string | null | undefined,
): string | null {
  if (!origin) return null;
  if (!domain) return origin; // oferta ainda sem domínio cadastrado — permissivo por enquanto

  try {
    const originHost = new URL(origin).hostname;
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (originHost === cleanDomain || originHost.endsWith("." + cleanDomain)) {
      return origin;
    }
  } catch {
    return null;
  }

  return null;
}

export function corsHeaders(origin: string | null): HeadersInit {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
