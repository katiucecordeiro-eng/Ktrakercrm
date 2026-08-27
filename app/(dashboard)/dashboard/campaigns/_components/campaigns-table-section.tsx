"use client";

import { useEffect, useRef } from "react";

import { CampaignTable } from "../../_components/campaign-table";
import { CampaignActionsCell } from "./campaign-actions-cell";
import { downloadCsv, rowsToCsv } from "@/lib/utils/csv";
import { useToast } from "@/components/ui/toast";
import { formatRoas } from "@/lib/format";
import type { CampaignAdRow, CampaignRow } from "@/lib/reports/types";

const CSV_HEADERS = [
  "Nível",
  "Campanha",
  "Conjunto",
  "Anúncio",
  "Status",
  "Gasto",
  "Faturamento",
  "Vendas",
  "ROAS",
  "CPA",
  "CTR (%)",
  "Impressões",
  "Cliques",
  "Visualizações de página",
  "IC",
  "Compras",
];

function campaignAdRowToCsvTail(row: CampaignAdRow) {
  return [
    row.spend,
    row.revenue,
    row.salesCount,
    row.roas,
    row.cpa,
    row.ctr,
    row.impressions,
    row.clicks,
    row.pageviews ?? null,
    row.initiateCheckout ?? null,
    row.salesCount,
  ];
}

function buildCsv(rows: CampaignRow[]): string {
  const lines: (string | number | null)[][] = [];
  for (const campaign of rows) {
    lines.push([
      "Campanha",
      campaign.name,
      "",
      "",
      campaign.unattributed ? "" : campaign.status === "ativo" ? "Ativa" : "Pausada",
      ...campaignAdRowToCsvTail(campaign),
    ]);
    for (const adset of campaign.adsets) {
      lines.push(["Conjunto", campaign.name, adset.name, "", "", ...campaignAdRowToCsvTail(adset)]);
      for (const ad of adset.ads) {
        lines.push(["Anúncio", campaign.name, adset.name, ad.name, "", ...campaignAdRowToCsvTail(ad)]);
      }
    }
  }
  return rowsToCsv(CSV_HEADERS, lines);
}

export function CampaignsTableSection({
  rows,
  currency,
  roasTarget,
}: {
  rows: CampaignRow[];
  currency: string;
  roasTarget: number;
}) {
  const { toast } = useToast();
  const warnedRef = useRef(false);

  // Avisa uma vez, quando os dados carregam, se alguma campanha com gasto
  // está abaixo da meta de ROAS da oferta — não é um alerta "em tempo
  // real" de verdade (gasto só muda quando alguém sincroniza com a Meta),
  // mas cobre o pedido de avisar quando o ROAS cai abaixo do threshold
  // sem precisar de um job de fundo dedicado.
  useEffect(() => {
    if (warnedRef.current) return;
    warnedRef.current = true;

    const belowTarget = rows.filter(
      (row) => !row.unattributed && row.spend > 0 && row.roas !== null && row.roas < roasTarget,
    );
    if (belowTarget.length === 0) return;

    const names = belowTarget
      .slice(0, 3)
      .map((row) => `${row.name} (${formatRoas(row.roas)})`)
      .join(", ");
    toast({
      title: `${belowTarget.length} campanha(s) abaixo da meta de ROAS (${roasTarget}x)`,
      description: names + (belowTarget.length > 3 ? "..." : ""),
      variant: "warning",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na carga inicial dos dados, não a cada re-render
  }, []);

  function handleExport() {
    const csv = buildCsv(rows);
    downloadCsv(`campanhas-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <CampaignTable
      rows={rows}
      currency={currency}
      showStatus
      onExportCsv={handleExport}
      roasTarget={roasTarget}
      renderActions={(row: CampaignAdRow, level) => (
        <CampaignActionsCell
          offerId={row.offerId}
          level={level}
          entityId={row.id}
          entityName={row.name}
          currency={currency}
        />
      )}
    />
  );
}
