"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { PaymentBreakdownRow } from "@/lib/reports/types";

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão",
  billet: "Boleto",
  boleto: "Boleto",
};

const METHOD_COLORS: Record<string, string> = {
  pix: "#22ff88",
  credit_card: "#5b8def",
  billet: "#ffb020",
  boleto: "#ffb020",
};

const FALLBACK_COLOR = "#8b98a9";

export function PaymentDonut({
  rows,
  currency,
}: {
  rows: PaymentBreakdownRow[];
  currency: string;
}) {
  const data = rows.map((row) => {
    const key = row.method.toLowerCase();
    return {
      name: METHOD_LABELS[key] ?? row.method,
      value: row.count,
      grossValue: row.value,
      color: METHOD_COLORS[key] ?? FALLBACK_COLOR,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por método de pagamento</CardTitle>
        <CardDescription>PIX, cartão, boleto — vendas aprovadas no período.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem vendas no período.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const entry = payload[0]!.payload as (typeof data)[number];
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium text-foreground">{entry.name}</p>
                        <p className="font-mono-nums text-muted-foreground">
                          {formatNumber(entry.value)} vendas · {formatCurrency(entry.grossValue, currency)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
