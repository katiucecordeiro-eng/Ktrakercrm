import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent, formatRoas } from "@/lib/format";
import type { KpiSummary } from "@/lib/reports/types";

function Kpi({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: "accent" | "warning" | "danger";
  className?: string;
}) {
  return (
    <Card className={cn(tone === "accent" && "glow-accent border-accent/40", className)}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <span
          className={cn(
            "font-mono-nums text-2xl font-semibold",
            tone === "accent" && "text-accent",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-danger",
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ kpis, currency }: { kpis: KpiSummary; currency: string }) {
  const profitTone = kpis.profit >= 0 ? "accent" : "danger";
  const refundTone = (kpis.refundRatePct ?? 0) > 10 ? "danger" : undefined;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      <Kpi label="Faturamento bruto" value={formatCurrency(kpis.grossRevenue, currency)} />
      <Kpi label="Faturamento líquido" value={formatCurrency(kpis.netRevenue, currency)} />
      <Kpi label="Gasto com anúncios" value={formatCurrency(kpis.adSpend, currency)} />
      <Kpi
        label="ROAS"
        value={formatRoas(kpis.roas)}
        tone="accent"
        className="lg:col-span-2 lg:row-span-1"
      />
      <Kpi label="Lucro" value={formatCurrency(kpis.profit, currency)} tone={profitTone} />
      <Kpi label="CPA" value={kpis.cpa !== null ? formatCurrency(kpis.cpa, currency) : "—"} />
      <Kpi label="Margem de lucro" value={formatPercent(kpis.marginPct)} />
      <Kpi label="Ticket médio" value={formatCurrency(kpis.averageTicket, currency)} />
      <Kpi label="Nº de vendas" value={formatNumber(kpis.salesCount)} />
      <Kpi label="Taxa de reembolso" value={formatPercent(kpis.refundRatePct)} tone={refundTone} />
      <Kpi
        label="Vendas reembolsadas"
        value={`${formatNumber(kpis.refundedCount)} · ${formatCurrency(kpis.refundedValue, currency)}`}
      />
      <Kpi label="Checkouts iniciados" value={formatNumber(kpis.initiatedCheckouts)} />
      <Kpi
        label="Custo por checkout"
        value={kpis.costPerCheckout !== null ? formatCurrency(kpis.costPerCheckout, currency) : "—"}
      />
    </div>
  );
}
