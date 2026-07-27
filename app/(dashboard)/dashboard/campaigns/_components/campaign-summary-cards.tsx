import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatRoas } from "@/lib/format";
import type { CampaignSummary } from "@/lib/reports/campaigns";

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono-nums text-xl">{value}</CardTitle>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

export function CampaignSummaryCards({
  summary,
  currency,
}: {
  summary: CampaignSummary;
  currency: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <SummaryCard
        label="Melhor campanha"
        value={summary.bestCampaign ? formatRoas(summary.bestCampaign.roas) : "—"}
        detail={summary.bestCampaign?.name}
      />
      <SummaryCard
        label="Melhor criativo"
        value={summary.bestCreative ? formatRoas(summary.bestCreative.roas) : "—"}
        detail={summary.bestCreative?.name}
      />
      <SummaryCard
        label="Pior campanha (candidata a pausar)"
        value={summary.worstCampaign ? formatRoas(summary.worstCampaign.roas) : "—"}
        detail={summary.worstCampaign?.name}
      />
      <SummaryCard label="Custo total do período" value={formatCurrency(summary.totalSpend, currency)} />
      <SummaryCard label="ROAS médio ponderado" value={formatRoas(summary.weightedRoas)} />
    </div>
  );
}
