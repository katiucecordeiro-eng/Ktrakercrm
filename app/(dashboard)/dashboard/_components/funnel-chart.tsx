"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import type { FunnelStep } from "@/lib/reports/types";
import type { VariantProps } from "class-variance-authority";

// Limiares de conversão entre etapas — heurística inicial (ajustável),
// não vem de nenhum benchmark de mercado.
function conversionVariant(pct: number | null): VariantProps<typeof badgeVariants>["variant"] {
  if (pct === null) return "outline";
  if (pct >= 40) return "default";
  if (pct >= 15) return "warning";
  return "destructive";
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const [view, setView] = useState<"funil" | "tabela">("funil");
  const max = Math.max(1, ...steps.map((s) => s.count));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Funil de conversão</CardTitle>
          <CardDescription>
            Cliques → página → carrinho → checkout → compra, com taxa de conversão
            entre cada etapa.
          </CardDescription>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={view === "funil" ? "bg-primary/15 text-accent" : "text-muted-foreground"}
            onClick={() => setView("funil")}
          >
            Funil
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={view === "tabela" ? "bg-primary/15 text-accent" : "text-muted-foreground"}
            onClick={() => setView("tabela")}
          >
            Tabela
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {view === "funil" ? (
          <div className="flex flex-col items-center gap-1">
            {steps.map((step, index) => {
              const widthPct = Math.max(6, (step.count / max) * 100);
              const nextWidthPct =
                index < steps.length - 1
                  ? Math.max(6, (steps[index + 1]!.count / max) * 100)
                  : widthPct;
              const inset = (widthPct - nextWidthPct) / 2 / widthPct;
              return (
                <div key={step.label} className="flex w-full flex-col items-center gap-1.5">
                  <div className="flex w-full max-w-2xl items-baseline justify-between text-sm">
                    <span className="text-foreground">{step.label}</span>
                    <span className="font-mono-nums text-muted-foreground">
                      {formatNumber(step.count)}
                    </span>
                  </div>
                  <div
                    className="h-10 bg-accent/70"
                    style={{
                      width: `${widthPct}%`,
                      maxWidth: "42rem",
                      clipPath: `polygon(0 0, 100% 0, ${100 - inset * 100}% 100%, ${inset * 100}% 100%)`,
                    }}
                  />
                  {index > 0 && (
                    <Badge variant={conversionVariant(step.conversionFromPrevious)}>
                      {formatPercent(step.conversionFromPrevious)}
                    </Badge>
                  )}
                  {index < steps.length - 1 && (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead>Contagem</TableHead>
                <TableHead>Conversão vs. anterior</TableHead>
                <TableHead>Conversão vs. primeiro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => (
                <TableRow key={step.label}>
                  <TableCell className="font-medium">{step.label}</TableCell>
                  <TableCell className="font-mono-nums">{formatNumber(step.count)}</TableCell>
                  <TableCell>
                    <Badge variant={conversionVariant(step.conversionFromPrevious)}>
                      {formatPercent(step.conversionFromPrevious)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono-nums text-muted-foreground">
                    {formatPercent(step.conversionFromFirst)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {steps.length > 0 && (
          <p className="pt-4 text-center text-xs text-muted-foreground">
            Conversão total (clique → compra): {formatPercent(steps.at(-1)?.conversionFromFirst ?? null)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
