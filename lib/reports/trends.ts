import type { KpiSummary } from "./types";

export type KpiDeltas = Partial<Record<keyof KpiSummary, number | null>>;

// % de variação de cada KPI numérico vs. o período anterior de mesma
// duração. null quando não dá pra calcular (campo não numérico em algum
// dos dois lados, ou período anterior zerado — divisão por zero vira "sem
// comparação" em vez de infinito).
export function computeKpiDeltas(current: KpiSummary, previous: KpiSummary): KpiDeltas {
  const deltas: KpiDeltas = {};
  for (const key of Object.keys(current) as (keyof KpiSummary)[]) {
    const curr = current[key];
    const prev = previous[key];
    if (typeof curr !== "number" || typeof prev !== "number") {
      deltas[key] = null;
      continue;
    }
    if (prev === 0) {
      deltas[key] = curr === 0 ? 0 : null;
      continue;
    }
    deltas[key] = ((curr - prev) / Math.abs(prev)) * 100;
  }
  return deltas;
}
