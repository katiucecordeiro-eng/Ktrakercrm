"use client";

import { Fragment, useState, type ReactNode } from "react";
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

function RoasBadge({ roas, roasTarget }: { roas: number | null; roasTarget: number }) {
  if (roas === null) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={roas >= roasTarget ? "default" : "destructive"}>{formatRoas(roas)}</Badge>;
}

function MetricsCells({
  row,
  currency,
  showMore,
  roasTarget,
}: {
  row: CampaignAdRow;
  currency: string;
  showMore: boolean;
  roasTarget: number;
}) {
  return (
    <>
      <TableCell className="font-mono-nums">{formatCurrency(row.spend, currency)}</TableCell>
      <TableCell className="font-mono-nums">{formatCurrency(row.revenue, currency)}</TableCell>
      <TableCell className="font-mono-nums">{formatNumber(row.salesCount)}</TableCell>
      <TableCell>
        <RoasBadge roas={row.roas} roasTarget={roasTarget} />
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
          <TableCell className="font-mono-nums">{formatNumber(row.clicks)}</TableCell>
          <TableCell className="font-mono-nums">
            {row.pageviews !== undefined ? formatNumber(row.pageviews) : "—"}
          </TableCell>
          <TableCell className="font-mono-nums">
            {row.initiateCheckout !== undefined ? formatNumber(row.initiateCheckout) : "—"}
          </TableCell>
          <TableCell className="font-mono-nums">{formatNumber(row.salesCount)}</TableCell>
        </>
      ) : null}
    </>
  );
}

// Soma todas as linhas de campanha visíveis (inclusive "sem atribuição",
// se estiver na lista) — representa exatamente o que está sendo somado
// visualmente acima, não só as campanhas atribuídas. Razões (ROAS, CPA,
// CTR, CPC, CPM, frequência) recalculadas a partir dos totais brutos
// (ponderado), nunca por média simples das linhas.
function computeTotals(rows: CampaignRow[]): CampaignAdRow {
  const spend = rows.reduce((sum, r) => sum + r.spend, 0);
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const salesCount = rows.reduce((sum, r) => sum + r.salesCount, 0);
  const clicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  const reach = rows.reduce((sum, r) => sum + r.reach, 0);
  const pageviews = rows.reduce((sum, r) => sum + (r.pageviews ?? 0), 0);
  const initiateCheckout = rows.reduce((sum, r) => sum + (r.initiateCheckout ?? 0), 0);

  return {
    id: "__total__",
    name: "Total",
    offerId: "",
    spend,
    revenue,
    salesCount,
    clicks,
    impressions,
    reach,
    pageviews,
    initiateCheckout,
    roas: spend > 0 ? revenue / spend : null,
    cpa: salesCount > 0 ? spend / salesCount : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    frequency: reach > 0 ? impressions / reach : null,
  };
}

export function CampaignTable({
  rows,
  currency,
  showStatus = false,
  onExportCsv,
  roasTarget = 2,
  renderActions,
}: {
  rows: CampaignRow[];
  currency: string;
  showStatus?: boolean;
  onExportCsv?: () => void;
  roasTarget?: number;
  // Só passado pela aba Campanhas (não na Visão Geral) — mantém o
  // gerenciamento de campanha fora deste componente compartilhado,
  // seguindo o mesmo padrão de onExportCsv.
  renderActions?: (row: CampaignAdRow, level: "campaign" | "adset" | "ad") => ReactNode;
}) {
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
            {roasTarget}x.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {onExportCsv ? (
            <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
              Exportar CSV
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => setShowMore((v) => !v)}>
            {showMore ? "Menos colunas" : "Mais colunas"}
          </Button>
        </div>
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
                {showStatus ? <TableHead>Status</TableHead> : null}
                {renderActions ? <TableHead>Ações</TableHead> : null}
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
                    <TableHead>Cliques</TableHead>
                    <TableHead>Visualizações de página</TableHead>
                    <TableHead>IC</TableHead>
                    <TableHead>Compras</TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((campaign) => {
                const campaignOpen = expandedCampaigns.has(campaign.id);
                if (campaign.unattributed) {
                  return (
                    <TableRow key={campaign.id} className="bg-surface/40">
                      <TableCell className="italic text-muted-foreground">{campaign.name}</TableCell>
                      {showStatus ? <TableCell>—</TableCell> : null}
                      {renderActions ? <TableCell>—</TableCell> : null}
                      <MetricsCells row={campaign} currency={currency} showMore={showMore} roasTarget={roasTarget} />
                    </TableRow>
                  );
                }
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
                      {showStatus ? (
                        <TableCell>
                          <Badge variant={campaign.status === "ativo" ? "default" : "secondary"}>
                            {campaign.status === "ativo" ? "Ativa" : "Pausada"}
                          </Badge>
                        </TableCell>
                      ) : null}
                      {renderActions ? (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {renderActions(campaign, "campaign")}
                        </TableCell>
                      ) : null}
                      <MetricsCells row={campaign} currency={currency} showMore={showMore} roasTarget={roasTarget} />
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
                              {showStatus ? <TableCell /> : null}
                              {renderActions ? (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {renderActions(adset, "adset")}
                                </TableCell>
                              ) : null}
                              <MetricsCells row={adset} currency={currency} showMore={showMore} roasTarget={roasTarget} />
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
                                  {showStatus ? <TableCell /> : null}
                                  {renderActions ? <TableCell>{renderActions(ad, "ad")}</TableCell> : null}
                                  <MetricsCells row={ad} currency={currency} showMore={showMore} roasTarget={roasTarget} />
                                </TableRow>
                              ))}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
              {showStatus ? (
                <TableRow className="border-t-2 border-accent bg-accent/10 font-semibold hover:bg-accent/10">
                  <TableCell className="text-foreground">Total</TableCell>
                  {showStatus ? <TableCell /> : null}
                  {renderActions ? <TableCell /> : null}
                  <MetricsCells
                    row={computeTotals(rows)}
                    currency={currency}
                    showMore={showMore}
                    roasTarget={roasTarget}
                  />
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
