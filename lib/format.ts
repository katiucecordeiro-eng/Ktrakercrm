import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone";

// Sem `timeZone` explícito, `toLocaleString` usa o fuso do processo — em
// produção (Vercel) isso é UTC, então qualquer data formatada em um
// Server Component aparecia até 3h à frente da hora real de Brasília.
export function formatDateTime(value: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone });
}

export function formatDate(value: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { dateStyle: "short", timeZone });
}

export function formatTime(value: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", { timeStyle: "short", timeZone });
}

export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value || 0);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value || 0));
}

export function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatRoas(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}x`;
}
