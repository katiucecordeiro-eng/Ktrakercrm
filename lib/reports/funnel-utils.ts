import type { FunnelStep } from "./types";

// Converte contagens brutas por etapa em FunnelStep[] (com % de conversão
// vs. etapa anterior e vs. a primeira) — compartilhado entre o funil geral
// (getFunnel) e o funil por campanha (getCampaignFunnel).
export function buildFunnelSteps(counts: { label: string; count: number }[]): FunnelStep[] {
  const first = counts[0]?.count || 0;

  return counts.map((step, index) => {
    const previous = index > 0 ? counts[index - 1]!.count : null;
    return {
      label: step.label,
      count: step.count,
      conversionFromPrevious: previous && previous > 0 ? (step.count / previous) * 100 : null,
      conversionFromFirst: first > 0 ? (step.count / first) * 100 : null,
    };
  });
}
