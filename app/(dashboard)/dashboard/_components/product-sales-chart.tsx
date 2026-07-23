import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { ProductSalesRow } from "@/lib/reports/types";

const BAR_COLORS = ["#22ff88", "#5b8def", "#ffb020", "#ff4757", "#8b98a9", "#a78bfa"];

export function ProductSalesChart({
  rows,
  currency,
}: {
  rows: ProductSalesRow[];
  currency: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por produto</CardTitle>
        <CardDescription>
          Faturamento bruto e participação de cada produto do funil, no período.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem vendas no período.</p>
        ) : (
          rows.map((row, index) => {
            const widthPct = Math.max(2, (row.value / max) * 100);
            const color = BAR_COLORS[index % BAR_COLORS.length];
            return (
              <div key={row.productId} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                  <span className="truncate text-foreground">{row.productName}</span>
                  <span className="font-mono-nums whitespace-nowrap text-muted-foreground">
                    {formatCurrency(row.value, currency)}{" "}
                    <span className="text-accent">({formatPercent(row.pct)})</span>
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-secondary">
                  <div
                    className="h-3 rounded-full"
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{formatNumber(row.count)} venda(s)</p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
