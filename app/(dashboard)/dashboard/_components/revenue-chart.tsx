"use client";

import { Suspense } from "react";
import {
  Bar,
  BarChart,
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
import type { Granularity, TimeSeriesPoint } from "@/lib/reports/types";
import { RevenueGranularityToggle } from "./revenue-granularity-toggle";

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

const GRANULARITY_DESCRIPTIONS: Record<Granularity, string> = {
  hour: "Por hora do dia (período de 1 dia).",
  day: "Por dia.",
  week: "Por semana.",
  month: "Por mês — bom pra comparar qual mês foi melhor.",
  weekday: "Somado por dia da semana (Seg a Dom) — bom pra achar o melhor dia pra vender/anunciar.",
};

export function RevenueChart({
  data,
  currency,
  granularity,
}: {
  data: TimeSeriesPoint[];
  currency: string;
  granularity: Granularity;
}) {
  // Semana/mês/dia da semana comparam poucos buckets entre si — barras
  // lado a lado deixam essa comparação mais legível que uma linha
  // contínua. Dia/hora (séries mais longas e contínuas) continuam em linha.
  const useBars = granularity === "week" || granularity === "month" || granularity === "weekday";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Faturamento × gasto × lucro</CardTitle>
          <CardDescription>{GRANULARITY_DESCRIPTIONS[granularity]}</CardDescription>
        </div>
        <Suspense>
          <RevenueGranularityToggle current={granularity} />
        </Suspense>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {useBars ? (
                <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
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
                  <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: "var(--surface-hover)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                  <Bar dataKey="revenue" name="Faturamento" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adSpend" name="Gasto" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Lucro" fill="var(--foreground)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
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
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
