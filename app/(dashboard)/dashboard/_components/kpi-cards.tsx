"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Info } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
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
  description,
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
  description?: string;
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
        <CardTitle className="flex items-center gap-1">
          {label}
          {description ? (
            <Tooltip content={description}>
              <Info className="size-3 cursor-help text-muted-foreground/60" />
            </Tooltip>
          ) : null}
        </CardTitle>
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
        description="Soma do valor de todas as vendas aprovadas no período, sem descontar reembolsos, imposto ou taxa da Hotmart."
        value={kpis.grossRevenue}
        format="currency"
        currency={currency}
        deltaPct={deltas.grossRevenue}
      />
      <Kpi
        label="Faturamento líquido"
        description="Faturamento bruto menos o valor de vendas reembolsadas/estornadas no período."
        value={kpis.netRevenue}
        format="currency"
        currency={currency}
        deltaPct={deltas.netRevenue}
      />
      <Kpi
        label="Gasto com anúncios"
        description="Soma do gasto sincronizado da Meta Ads (Marketing API) de todas as campanhas ativas no período."
        value={kpis.adSpend}
        format="currency"
        currency={currency}
        deltaPct={deltas.adSpend}
        deltaNeutral
      />
      <Kpi
        label="ROAS"
        description="Faturamento bruto ÷ gasto com anúncios. Borda pulsante quando ≥ 2x."
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
        description="Faturamento líquido − gasto com anúncios − imposto da oferta (ponderado quando 'todas as ofertas' está selecionado)."
        value={kpis.profit}
        format="currency"
        currency={currency}
        tone={profitTone}
        deltaPct={deltas.profit}
      />
      <Kpi
        label="CPA"
        description="Custo por aquisição: gasto com anúncios ÷ número de vendas aprovadas no período."
        value={kpis.cpa}
        format="currency"
        currency={currency}
        deltaPct={deltas.cpa}
        deltaInvert
      />
      <Kpi
        label="Margem de lucro"
        description="Lucro ÷ faturamento bruto, em %."
        value={kpis.marginPct}
        format="percent"
        currency={currency}
        deltaPct={deltas.marginPct}
      />
      <Kpi
        label="Ticket médio"
        description="Faturamento bruto ÷ número de vendas aprovadas no período."
        value={kpis.averageTicket}
        format="currency"
        currency={currency}
        deltaPct={deltas.averageTicket}
      />
      <Kpi
        label="Nº de vendas"
        description="Total de vendas aprovadas no período."
        value={kpis.salesCount}
        format="number"
        currency={currency}
        deltaPct={deltas.salesCount}
      />
      <Kpi
        label="Taxa de reembolso"
        description="Vendas reembolsadas/estornadas ÷ (vendas aprovadas + reembolsadas), em %."
        value={kpis.refundRatePct}
        format="percent"
        currency={currency}
        tone={refundTone}
        deltaPct={deltas.refundRatePct}
        deltaInvert
      />
      <Kpi
        label="Vendas reembolsadas"
        description="Quantidade e valor bruto de vendas reembolsadas ou com chargeback no período."
        value={kpis.refundedCount}
        format="number"
        currency={currency}
        deltaPct={deltas.refundedCount}
        deltaInvert
        suffix={<span className="text-muted-foreground"> · {formatCurrency(kpis.refundedValue, currency)}</span>}
      />
      <Kpi
        label="Checkouts iniciados"
        description="Total de eventos InitiateCheckout registrados no período (via track.js)."
        value={kpis.initiatedCheckouts}
        format="number"
        currency={currency}
        deltaPct={deltas.initiatedCheckouts}
      />
      <Kpi
        label="Custo por checkout"
        description="Gasto com anúncios ÷ número de checkouts iniciados no período."
        value={kpis.costPerCheckout}
        format="currency"
        currency={currency}
        deltaPct={deltas.costPerCheckout}
        deltaInvert
      />
    </div>
  );
}
