"use client";

import { CampaignTable } from "../../_components/campaign-table";
import { downloadCsv, rowsToCsv } from "@/lib/utils/csv";
import type { CampaignRow } from "@/lib/reports/types";

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
];

function buildCsv(rows: CampaignRow[]): string {
  const lines: (string | number | null)[][] = [];
  for (const campaign of rows) {
    lines.push([
      "Campanha",
      campaign.name,
      "",
      "",
      campaign.unattributed ? "" : campaign.status === "ativo" ? "Ativa" : "Pausada",
      campaign.spend,
      campaign.revenue,
      campaign.salesCount,
      campaign.roas,
      campaign.cpa,
      campaign.ctr,
      campaign.impressions,
      campaign.clicks,
    ]);
    for (const adset of campaign.adsets) {
      lines.push([
        "Conjunto",
        campaign.name,
        adset.name,
        "",
        "",
        adset.spend,
        adset.revenue,
        adset.salesCount,
        adset.roas,
        adset.cpa,
        adset.ctr,
        adset.impressions,
        adset.clicks,
      ]);
      for (const ad of adset.ads) {
        lines.push([
          "Anúncio",
          campaign.name,
          adset.name,
          ad.name,
          "",
          ad.spend,
          ad.revenue,
          ad.salesCount,
          ad.roas,
          ad.cpa,
          ad.ctr,
          ad.impressions,
          ad.clicks,
        ]);
      }
    }
  }
  return rowsToCsv(CSV_HEADERS, lines);
}

export function CampaignsTableSection({ rows, currency }: { rows: CampaignRow[]; currency: string }) {
  function handleExport() {
    const csv = buildCsv(rows);
    downloadCsv(`campanhas-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return <CampaignTable rows={rows} currency={currency} showStatus onExportCsv={handleExport} />;
}
