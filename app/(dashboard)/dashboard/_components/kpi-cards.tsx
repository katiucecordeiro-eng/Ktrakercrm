"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent, formatRoas } from "@/lib/format";
import { useCountUp } from "@/hooks/use-count-up";
import { computeKpiDeltas } from "@/lib/reports/trends";
import type { KpiSummary } from "@/lib/reports/types";

type KpiFormat = "currency" | "number" | "percent" | "roas";

function formatValue(value: number, format: KpiFormat, currency: string): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, currency);
    case "percent":
      return formatPercent(value);
    case "roas":
      return formatRoas(value);
    case "number":
    default:
      return formatNumber(value);
  }
}

// Pra métricas de "custo" (CPA, gasto, reembolso...), subir é ruim e
// descer é bom — o oposto de receita/vendas. `invert` inverte a lógica de
// cor sem inverter a seta (a seta sempre reflete a direção real do número).
function DeltaChip({
  deltaPct,
  invert,
  neutral,
}: {
  deltaPct: number | null | undefined;
  invert?: boolean;
  neutral?: boolean;
}) {
  if (deltaPct === null || deltaPct === undefined || Number.isNaN(deltaPct)) return null;
  const isUp = deltaPct > 0;
  const isFlat = deltaPct === 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        (isFlat || neutral) && "text-muted-foreground",
        !isFlat && !neutral && isGood && "text-accent",
        !isFlat && !neutral && !isGood && "text-danger",
      )}
      title="vs. período anterior"
    >
      {!isFlat && (isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      {Math.abs(deltaPct).toFixed(1)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  format,
  currency,
  tone,
  deltaPct,
  deltaInvert,
  deltaNeutral,
  glowPulse,
  suffix,
  className,
}: {
  label: string;
  value: number | null;
  format: KpiFormat;
  currency: string;
  tone?: "accent" | "warning" | "danger";
  deltaPct?: number | null;
  deltaInvert?: boolean;
  deltaNeutral?: boolean;
  glowPulse?: boolean;
  suffix?: ReactNode;
  className?: string;
}) {
  const animated = useCountUp(value ?? 0);
  const display = value === null ? "—" : formatValue(animated, format, currency);

  return (
    <Card
      className={cn(
        tone === "accent" && "glow-accent border-accent/40",
        glowPulse && "animate-glow-pulse",
        className,
      )}
    >
      <CardHeader className="gap-1.5">
        <CardTitle>{label}</CardTitle>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono-nums text-2xl font-semibold",
              tone === "accent" && "text-accent",
              tone === "warning" && "text-warning",
              tone === "danger" && "text-danger",
            )}
          >
            {display}
            {suffix}
          </span>
          <DeltaChip deltaPct={deltaPct} invert={deltaInvert} neutral={deltaNeutral} />
        </div>
      </CardHeader>
    </Card>
  );
}

export function KpiCards({
  kpis,
  previousKpis,
  currency,
}: {
  kpis: KpiSummary;
  previousKpis?: KpiSummary;
  currency: string;
}) {
  const profitTone = kpis.profit >= 0 ? "accent" : "danger";
  const refundTone = (kpis.refundRatePct ?? 0) > 10 ? "danger" : undefined;
  const deltas = previousKpis ? computeKpiDeltas(kpis, previousKpis) : {};

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      <Kpi
        label="Faturamento bruto"
        value={kpis.grossRevenue}
        format="currency"
        currency={currency}
        deltaPct={deltas.grossRevenue}
      />
      <Kpi
        label="Faturamento líquido"
        value={kpis.netRevenue}
        format="currency"
        currency={currency}
        deltaPct={deltas.netRevenue}
      />
      <Kpi
        label="Gasto com anúncios"
        value={kpis.adSpend}
        format="currency"
        currency={currency}
        deltaPct={deltas.adSpend}
        deltaNeutral
      />
      <Kpi
        label="ROAS"
        value={kpis.roas}
        format="roas"
        currency={currency}
        tone="accent"
        glowPulse={(kpis.roas ?? 0) >= 2}
        deltaPct={deltas.roas}
        className="lg:col-span-2 lg:row-span-1"
      />
      <Kpi
        label="Lucro"
        value={kpis.profit}
        format="currency"
        currency={currency}
        tone={profitTone}
        deltaPct={deltas.profit}
      />
      <Kpi
        label="CPA"
        value={kpis.cpa}
        format="currency"
        currency={currency}
        deltaPct={deltas.cpa}
        deltaInvert
      />
      <Kpi
        label="Margem de lucro"
        value={kpis.marginPct}
        format="percent"
        currency={currency}
        deltaPct={deltas.marginPct}
      />
      <Kpi
        label="Ticket médio"
        value={kpis.averageTicket}
        format="currency"
        currency={currency}
        deltaPct={deltas.averageTicket}
      />
      <Kpi
        label="Nº de vendas"
        value={kpis.salesCount}
        format="number"
        currency={currency}
        deltaPct={deltas.salesCount}
      />
      <Kpi
        label="Taxa de reembolso"
        value={kpis.refundRatePct}
        format="percent"
        currency={currency}
        tone={refundTone}
        deltaPct={deltas.refundRatePct}
        deltaInvert
      />
      <Kpi
        label="Vendas reembolsadas"
        value={kpis.refundedCount}
        format="number"
        currency={currency}
        deltaPct={deltas.refundedCount}
        deltaInvert
        suffix={<span className="text-muted-foreground"> · {formatCurrency(kpis.refundedValue, currency)}</span>}
      />
      <Kpi
        label="Checkouts iniciados"
        value={kpis.initiatedCheckouts}
        format="number"
        currency={currency}
        deltaPct={deltas.initiatedCheckouts}
      />
      <Kpi
        label="Custo por checkout"
        value={kpis.costPerCheckout}
        format="currency"
        currency={currency}
        deltaPct={deltas.costPerCheckout}
        deltaInvert
      />
    </div>
  );
}
