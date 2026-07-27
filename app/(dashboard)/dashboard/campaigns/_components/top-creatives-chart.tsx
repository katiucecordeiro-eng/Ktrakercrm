"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRoas } from "@/lib/format";
import type { CampaignAdRow } from "@/lib/reports/types";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CampaignAdRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 max-w-[220px] truncate font-medium text-foreground">{row.name}</p>
      <p className="font-mono-nums text-accent">ROAS: {formatRoas(row.roas)}</p>
    </div>
  );
}

export function TopCreativesChart({ creatives }: { creatives: CampaignAdRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 criativos por ROAS</CardTitle>
        <CardDescription>Anúncios com gasto no período, ordenados por retorno.</CardDescription>
      </CardHeader>
      <CardContent>
        {creatives.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem criativos com gasto no período.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={creatives} layout="vertical" margin={{ left: 4, right: 24, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatRoas(value)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 18)}…` : value)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
                <Bar dataKey="roas" name="ROAS" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
