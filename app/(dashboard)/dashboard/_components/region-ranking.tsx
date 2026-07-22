import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { RegionRow } from "@/lib/reports/types";

export function RegionRanking({ rows }: { rows: RegionRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking por região</CardTitle>
        <CardDescription>Estado/cidade dos visitantes no período.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem dados de geolocalização no período (só disponível em produção na
            Vercel).
          </p>
        ) : (
          rows.map((row) => (
            <div key={`${row.region}-${row.city}`} className="flex items-center gap-3">
              <div className="w-32 shrink-0 truncate text-sm text-foreground">
                {row.city ? `${row.city}, ${row.region}` : row.region}
              </div>
              <div className="h-2 flex-1 rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-accent/70"
                  style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono-nums text-sm text-muted-foreground">
                {formatNumber(row.count)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
