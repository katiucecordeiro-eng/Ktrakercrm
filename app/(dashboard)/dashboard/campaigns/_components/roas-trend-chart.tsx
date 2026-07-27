"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRoas } from "@/lib/format";
import type { RoasPoint } from "@/lib/reports/types";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <p className="font-mono-nums text-accent">ROAS: {formatRoas(payload[0]!.value)}</p>
    </div>
  );
}

export function RoasTrendChart({ data }: { data: RoasPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução do ROAS por dia</CardTitle>
        <CardDescription>Faturamento aprovado ÷ gasto sincronizado, por dia.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="h-64 w-full">
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
                  width={48}
                  tickFormatter={(value: number) => formatRoas(value)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-subtle)" }} />
                <Line
                  type="monotone"
                  dataKey="roas"
                  name="ROAS"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
