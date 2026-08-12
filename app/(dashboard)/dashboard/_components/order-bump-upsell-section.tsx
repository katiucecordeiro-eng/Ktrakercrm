import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { OrderBumpUpsellMetrics, ProductRole } from "@/lib/reports/product-roles";

const ROLE_LABELS: Record<ProductRole, string> = {
  principal: "Principal",
  order_bump: "Order bump",
  upsell: "Upsell",
  downsell: "Downsell",
};

export function OrderBumpUpsellSection({
  metrics,
  currency,
}: {
  metrics: OrderBumpUpsellMetrics;
  currency: string;
}) {
  if (metrics.products.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order bump & upsell</CardTitle>
        <CardDescription>
          Taxa de anexo = vendas do produto ÷ vendas do produto principal ({formatNumber(metrics.principalCount)}{" "}
          no período) — contagem por produto, não um link de transação a transação, então um order
          bump/upsell vendido sem o principal no mesmo recorte pode inflar levemente a taxa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Vendas</TableHead>
              <TableHead>Faturamento</TableHead>
              <TableHead>Taxa de anexo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.products.map((product) => (
              <TableRow key={product.productId}>
                <TableCell className="max-w-[240px] truncate">
                  {product.productName ?? product.productId}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[product.role]}</Badge>
                </TableCell>
                <TableCell className="font-mono-nums">{formatNumber(product.count)}</TableCell>
                <TableCell className="font-mono-nums">{formatCurrency(product.revenue, currency)}</TableCell>
                <TableCell className="font-mono-nums">
                  {product.attachRatePct !== null ? formatPercent(product.attachRatePct) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
