"use client";

import Link from "next/link";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { LEAD_MATURITY_LABELS, type LeadMaturityResult, type LeadMaturityStage } from "@/lib/reports/lead-maturity";

const STAGE_COLORS: Record<LeadMaturityStage, string> = {
  frio: "#6f8fc4",
  morno: "var(--warning)",
  quente: "var(--danger)",
  comprador: "var(--accent)",
  embaixador: "#c2799a",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function LeadMaturitySection({ result }: { result: LeadMaturityResult }) {
  const data = result.distribution.map((row) => ({
    name: LEAD_MATURITY_LABELS[row.stage],
    value: row.count,
    color: STAGE_COLORS[row.stage],
  }));
  const total = data.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Jornada de maturidade do lead</CardTitle>
          <CardDescription>
            Frio (1ª visita) → morno (2+ visitas) → quente (chegou ao checkout) → comprador → embaixador
            (comprou e voltou).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sem visitantes ainda.</p>
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
                          <p className="font-mono-nums text-muted-foreground">{formatNumber(entry.value)}</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Visitantes quentes</CardTitle>
          <CardDescription>
            Chegaram ao checkout mas não compraram — lista prioritária de remarketing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.hotVisitors.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum visitante quente no momento.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Última atividade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.hotVisitors.map((visitor) => (
                    <TableRow key={visitor.visitorId}>
                      <TableCell>
                        <Link
                          href={`/dashboard/visitors/${visitor.visitorId}`}
                          className="hover:underline"
                        >
                          {visitor.leadName || visitor.leadEmail || visitor.visitorId.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {visitor.utmSource || "direto/orgânico"}
                      </TableCell>
                      <TableCell className="font-mono-nums text-xs text-muted-foreground">
                        {formatDateTime(visitor.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
