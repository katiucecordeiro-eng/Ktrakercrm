import type { Offer } from "@/lib/types/offer";
import type { Granularity, PeriodPreset, ReportFilters } from "./types";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

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

  const periodParam = (param(searchParams, "period") ?? "30d") as PeriodPreset;
  const now = new Date();

  let since: Date;
  let until: Date;
  let period: PeriodPreset = periodParam;

  switch (periodParam) {
    case "today":
      since = startOfDay(now);
      until = now;
      break;
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      since = startOfDay(y);
      until = endOfDay(y);
      break;
    }
    case "7d":
      since = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
      until = now;
      break;
    case "this_month":
      since = new Date(now.getFullYear(), now.getMonth(), 1);
      until = now;
      break;
    case "last_month": {
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      since = new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth() - 1, 1);
      until = new Date(firstOfThisMonth.getTime() - 1);
      break;
    }
    case "custom": {
      const sinceParam = param(searchParams, "since");
      const untilParam = param(searchParams, "until");
      since = sinceParam
        ? startOfDay(new Date(sinceParam))
        : startOfDay(new Date(now.getTime() - 29 * 86_400_000));
      until = untilParam ? endOfDay(new Date(untilParam)) : now;
      break;
    }
    case "30d":
    default:
      period = "30d";
      since = startOfDay(new Date(now.getTime() - 29 * 86_400_000));
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
