import type { Offer } from "@/lib/types/offer";
import type { Granularity, PeriodPreset, ReportFilters } from "./types";
import { DEFAULT_TIMEZONE, endOfDayInTimezone, startOfDayInTimezone, startOfMonthInTimezone } from "@/lib/utils/timezone";

function pickGranularity(since: Date, until: Date): Granularity {
  const days = (until.getTime() - since.getTime()) / 86_400_000;
  if (days <= 1.5) return "hour";
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: RawSearchParams, key: string): string | null {
  const value = searchParams[key];
  return typeof value === "string" ? value : null;
}

export function parseReportFilters(searchParams: RawSearchParams, offers: Offer[]): ReportFilters {
  const offerSlugParam = param(searchParams, "offer");
  const offer = offerSlugParam ? (offers.find((o) => o.slug === offerSlugParam) ?? null) : null;
  // Fuso da oferta selecionada; em "todas as ofertas" cai pro fuso padrão
  // do projeto (Brasil) — sem isso, "Hoje"/"Ontem" viravam os limites do
  // dia em UTC (fuso do servidor na Vercel), até 3h defasados da hora real.
  const timezone = offer?.timezone ?? DEFAULT_TIMEZONE;

  const periodParam = (param(searchParams, "period") ?? "today") as PeriodPreset;
  const now = new Date();

  let since: Date;
  let until: Date;
  let period: PeriodPreset = periodParam;

  switch (periodParam) {
    case "today":
      since = startOfDayInTimezone(now, timezone);
      until = now;
      break;
    case "yesterday": {
      const y = new Date(now.getTime() - 86_400_000);
      since = startOfDayInTimezone(y, timezone);
      until = endOfDayInTimezone(y, timezone);
      break;
    }
    case "7d":
      since = startOfDayInTimezone(new Date(now.getTime() - 6 * 86_400_000), timezone);
      until = now;
      break;
    case "this_month":
      since = startOfMonthInTimezone(now, timezone);
      until = now;
      break;
    case "last_month": {
      const firstOfThisMonth = startOfMonthInTimezone(now, timezone);
      const lastMonthRef = new Date(firstOfThisMonth.getTime() - 86_400_000);
      since = startOfMonthInTimezone(lastMonthRef, timezone);
      until = new Date(firstOfThisMonth.getTime() - 1);
      break;
    }
    case "custom": {
      const sinceParam = param(searchParams, "since");
      const untilParam = param(searchParams, "until");
      since = sinceParam
        ? startOfDayInTimezone(new Date(`${sinceParam}T12:00:00Z`), timezone)
        : startOfDayInTimezone(new Date(now.getTime() - 29 * 86_400_000), timezone);
      until = untilParam ? endOfDayInTimezone(new Date(`${untilParam}T12:00:00Z`), timezone) : now;
      break;
    }
    case "30d":
    default:
      period = "30d";
      since = startOfDayInTimezone(new Date(now.getTime() - 29 * 86_400_000), timezone);
      until = now;
      break;
  }

  return {
    offerId: offer?.id ?? null,
    offerSlug: offer?.slug ?? null,
    period,
    since,
    until,
    granularity: pickGranularity(since, until),
  };
}

// Período imediatamente anterior, com a mesma duração — usado pelos KPIs
// pra calcular o delta % vs. período anterior. offerId/offerSlug/period
// preservados; granularidade recalculada porque a duração é idêntica mas
// não custa garantir.
export function getPreviousPeriodFilters(filters: ReportFilters): ReportFilters {
  const durationMs = filters.until.getTime() - filters.since.getTime();
  const until = new Date(filters.since.getTime() - 1);
  const since = new Date(until.getTime() - durationMs);
  return {
    ...filters,
    since,
    until,
    granularity: pickGranularity(since, until),
  };
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  this_month: "Este mês",
  last_month: "Mês passado",
  custom: "Personalizado",
};

export const PERIOD_OPTIONS: PeriodPreset[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "this_month",
  "last_month",
  "custom",
];
