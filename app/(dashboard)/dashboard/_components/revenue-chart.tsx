"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { TimeSeriesPoint } from "@/lib/reports/types";

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-mono-nums" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value, currency)}
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({
  data,
  currency,
}: {
  data: TimeSeriesPoint[];
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturamento × gasto × lucro</CardTitle>
        <CardDescription>Granularidade ajustada automaticamente ao período.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(value: number) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value)}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "var(--border-subtle)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Faturamento"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="adSpend"
                  name="Gasto"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Lucro"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
