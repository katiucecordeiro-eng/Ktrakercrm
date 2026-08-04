// Heurística de urgência do SLA de resposta — sem benchmark formal por trás
// dos limiares, ajustável conforme o uso real (mesmo espírito do
// ROAS_THRESHOLD do dashboard KTracker: constante isolada, fácil de tunar).
const SLA_URGENTE_HORAS = 6;

export type SlaEstado = "vencido" | "urgente" | "ok";

export function slaEstado(slaLimite: string, agora: Date = new Date()): SlaEstado {
  const limite = new Date(slaLimite).getTime();
  const diffHoras = (limite - agora.getTime()) / (1000 * 60 * 60);

  if (diffHoras < 0) return "vencido";
  if (diffHoras <= SLA_URGENTE_HORAS) return "urgente";
  return "ok";
}

export const SLA_BADGE_VARIANT: Record<SlaEstado, "default" | "warning" | "destructive"> = {
  vencido: "destructive",
  urgente: "warning",
  ok: "default",
};

export function formatarPrazoSla(slaLimite: string, agora: Date = new Date()): string {
  const limite = new Date(slaLimite).getTime();
  const diffMs = limite - agora.getTime();
  const diffHoras = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));

  if (diffMs < 0) {
    if (diffHoras < 24) return `Vencido há ${diffHoras}h`;
    return `Vencido há ${Math.round(diffHoras / 24)}d`;
  }

  if (diffHoras < 24) return `Faltam ${diffHoras}h`;
  return `Faltam ${Math.round(diffHoras / 24)}d`;
}
