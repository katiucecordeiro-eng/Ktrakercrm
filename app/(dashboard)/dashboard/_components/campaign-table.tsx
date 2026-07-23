"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatNumber, formatPercent, formatRoas } from "@/lib/format";
import type { CampaignAdRow, CampaignRow } from "@/lib/reports/types";

const ROAS_THRESHOLD = 2;

function RoasBadge({ roas }: { roas: number | null }) {
  if (roas === null) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={roas >= ROAS_THRESHOLD ? "default" : "destructive"}>{formatRoas(roas)}</Badge>;
}

function MetricsCells({
  row,
  currency,
  showMore,
}: {
  row: CampaignAdRow;
  currency: string;
  showMore: boolean;
}) {
  return (
    <>
      <TableCell className="font-mono-nums">{formatCurrency(row.spend, currency)}</TableCell>
      <TableCell className="font-mono-nums">{formatCurrency(row.revenue, currency)}</TableCell>
      <TableCell className="font-mono-nums">{formatNumber(row.salesCount)}</TableCell>
      <TableCell>
        <RoasBadge roas={row.roas} />
      </TableCell>
      <TableCell className="font-mono-nums">
        {row.cpa !== null ? formatCurrency(row.cpa, currency) : "—"}
      </TableCell>
      <TableCell className="font-mono-nums">{formatPercent(row.ctr)}</TableCell>
      {showMore ? (
        <>
          <TableCell className="font-mono-nums">{formatNumber(row.impressions)}</TableCell>
          <TableCell className="font-mono-nums">{formatNumber(row.reach)}</TableCell>
          <TableCell className="font-mono-nums">
            {row.frequency !== null ? row.frequency.toFixed(2) : "—"}
          </TableCell>
          <TableCell className="font-mono-nums">
            {row.cpc !== null ? formatCurrency(row.cpc, currency) : "—"}
          </TableCell>
          <TableCell className="font-mono-nums">
            {row.cpm !== null ? formatCurrency(row.cpm, currency) : "—"}
          </TableCell>
        </>
      ) : null}
    </>
  );
}

export function CampaignTable({ rows, currency }: { rows: CampaignRow[]; currency: string }) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);

  function toggleCampaign(id: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAdset(key: string) {
    setExpandedAdsets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Campanhas e criativos</CardTitle>
          <CardDescription>
            Clique numa campanha para ver conjuntos, e num conjunto para ver os
            anúncios/criativos (destacados em outra cor). Badge verde: ROAS ≥{" "}
            {ROAS_THRESHOLD}x.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowMore((v) => !v)}>
          {showMore ? "Menos colunas" : "Mais colunas"}
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem gasto ou vendas com campanha/criativo no período.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Gasto</TableHead>
                <TableHead>Faturamento</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead>ROAS</TableHead>
                <TableHead>CPA</TableHead>
                <TableHead>CTR</TableHead>
                {showMore ? (
                  <>
                    <TableHead>Impressões</TableHead>
                    <TableHead>Alcance</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>CPC</TableHead>
                    <TableHead>CPM</TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((campaign) => {
                const campaignOpen = expandedCampaigns.has(campaign.id);
                return (
                  <Fragment key={campaign.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleCampaign(campaign.id)}>
                      <TableCell className="flex items-center gap-2 font-medium">
                        {campaignOpen ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                        <span className="max-w-[280px] truncate">{campaign.name}</span>
                      </TableCell>
                      <MetricsCells row={campaign} currency={currency} showMore={showMore} />
                    </TableRow>
                    {campaignOpen &&
                      campaign.adsets.map((adset) => {
                        const adsetKey = `${campaign.id}:${adset.id}`;
                        const adsetOpen = expandedAdsets.has(adsetKey);
                        return (
                          <Fragment key={adsetKey}>
                            <TableRow
                              className="cursor-pointer bg-surface/60"
                              onClick={() => toggleAdset(adsetKey)}
                            >
                              <TableCell className="flex items-center gap-2 pl-8 text-muted-foreground">
                                {adsetOpen ? (
                                  <ChevronDown className="size-3.5" />
                                ) : (
                                  <ChevronRight className="size-3.5" />
                                )}
                                <span className="max-w-[240px] truncate">{adset.name}</span>
                              </TableCell>
                              <MetricsCells row={adset} currency={currency} showMore={showMore} />
                            </TableRow>
                            {adsetOpen &&
                              adset.ads.map((ad) => (
                                <TableRow
                                  key={`${adsetKey}:${ad.id}`}
                                  className="bg-accent/10 hover:bg-accent/15"
                                >
                                  <TableCell className="pl-14 text-muted-foreground">
                                    <span className="max-w-[220px] truncate">{ad.name}</span>
                                  </TableCell>
                                  <MetricsCells row={ad} currency={currency} showMore={showMore} />
                                </TableRow>
                              ))}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
