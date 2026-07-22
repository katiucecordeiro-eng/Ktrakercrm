"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { HourlyRow } from "@/lib/reports/types";

export function HourlyChart({ rows }: { rows: HourlyRow[] }) {
  const data = rows.map((row) => ({ hour: `${String(row.hour).padStart(2, "0")}h`, count: row.count }));
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por hora do dia</CardTitle>
        <CardDescription>Melhor horário para concentrar campanhas.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem vendas no período.</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  interval={1}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  cursor={{ fill: "var(--surface-hover)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium text-foreground">{label}</p>
                        <p className="font-mono-nums text-accent">{formatNumber(payload[0]!.value as number)} vendas</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
