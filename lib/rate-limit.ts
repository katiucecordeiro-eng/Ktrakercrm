// Rate limiter básico em memória, por IP — suficiente para conter abuso
// simples num único processo. Em produção na Vercel cada instância
// serverless tem seu próprio estado (reinicia a cada cold start), então
// isso não substitui um limitador distribuído (ex.: Upstash Redis) se o
// tráfego crescer muito.
const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 30;

const hits = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(key, timestamps);

  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return timestamps.length > MAX_REQUESTS_PER_WINDOW;
}
