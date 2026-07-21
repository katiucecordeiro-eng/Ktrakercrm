import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { FunnelStep } from "@/lib/reports/types";

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão</CardTitle>
        <CardDescription>
          Cliques → página → carrinho → checkout → compra, com taxa de conversão
          entre cada etapa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const widthPct = Math.max(4, (step.count / max) * 100);
          return (
            <div key={step.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{step.label}</span>
                <span className="font-mono-nums text-muted-foreground">
                  {formatNumber(step.count)}
                  {index > 0 && (
                    <>
                      {" "}
                      <span className="text-accent">
                        ({formatPercent(step.conversionFromPrevious)})
                      </span>
                    </>
                  )}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-secondary">
                <div
                  className="h-3 rounded-full bg-accent/70"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
        {steps.length > 0 && (
          <p className="pt-2 text-xs text-muted-foreground">
            Conversão total (clique → compra): {formatPercent(steps.at(-1)?.conversionFromFirst ?? null)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
