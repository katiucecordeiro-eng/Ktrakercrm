"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent, formatRoas } from "@/lib/format";
import type { CreativeInsight, CreativeMaturity } from "@/lib/reports/creative-insights";

const MATURITY_LABELS: Record<CreativeMaturity, string> = {
  saturado: "Saturado",
  escalavel: "🔥 Escalável",
  neutro: "Neutro",
};

const MATURITY_VARIANTS: Record<CreativeMaturity, "destructive" | "default" | "outline"> = {
  saturado: "destructive",
  escalavel: "default",
  neutro: "outline",
};

type SortKey = "roas" | "ctr" | "spend" | "maturity";

const MATURITY_ORDER: Record<CreativeMaturity, number> = { saturado: 0, escalavel: 1, neutro: 2 };

function sortInsights(insights: CreativeInsight[], sortBy: SortKey): CreativeInsight[] {
  const copy = [...insights];
  copy.sort((a, b) => {
    if (sortBy === "maturity") return MATURITY_ORDER[a.maturity] - MATURITY_ORDER[b.maturity];
    if (sortBy === "roas") return (b.roas ?? -1) - (a.roas ?? -1);
    if (sortBy === "ctr") return (b.ctr ?? -1) - (a.ctr ?? -1);
    return b.spend - a.spend;
  });
  return copy;
}

export function CreativePerformanceTable({
  insights,
  currency,
}: {
  insights: CreativeInsight[];
  currency: string;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("roas");
  const sorted = sortInsights(insights, sortBy);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Performance de criativos pagos</CardTitle>
          <CardDescription>
            Score de maturidade por frequência × CTR (vs. período anterior) — heurística ajustável, não é
            um dado oficial da Meta.
          </CardDescription>
        </div>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="roas">Ordenar por ROAS</SelectItem>
            <SelectItem value="ctr">Ordenar por CTR</SelectItem>
            <SelectItem value="spend">Ordenar por gasto</SelectItem>
            <SelectItem value="maturity">Ordenar por saturação</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem criativos com gasto no período.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criativo</TableHead>
                <TableHead>Gasto</TableHead>
                <TableHead>ROAS</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>CPM</TableHead>
                <TableHead>Maturidade</TableHead>
                <TableHead>Recomendação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.adId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- thumbnail externo da Meta, domínio dinâmico por conta
                        <img
                          src={row.thumbnailUrl}
                          alt=""
                          className="size-9 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded bg-surface-hover text-muted-foreground">
                          <ImageOff className="size-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="max-w-[180px] truncate text-sm font-medium text-foreground">{row.name}</p>
                        <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                          {row.campaignName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono-nums">{formatCurrency(row.spend, currency)}</TableCell>
                  <TableCell className="font-mono-nums">{formatRoas(row.roas)}</TableCell>
                  <TableCell className="font-mono-nums">{formatPercent(row.ctr)}</TableCell>
                  <TableCell className="font-mono-nums">
                    {row.frequency !== null ? row.frequency.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="font-mono-nums">
                    {row.cpm !== null ? formatCurrency(row.cpm, currency) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={MATURITY_VARIANTS[row.maturity]}>{MATURITY_LABELS[row.maturity]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.recommendation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="pt-4 text-center text-xs text-muted-foreground">{formatNumber(sorted.length)} criativo(s) com gasto no período.</p>
      </CardContent>
    </Card>
  );
}
