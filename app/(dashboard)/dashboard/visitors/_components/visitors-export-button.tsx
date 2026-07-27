"use client";

import { Button } from "@/components/ui/button";
import { downloadCsv, rowsToCsv } from "@/lib/utils/csv";
import type { VisitorSummaryRow } from "@/lib/crm/types";

const CSV_HEADERS = [
  "Visitor ID",
  "Nome",
  "E-mail",
  "Telefone",
  "Status",
  "Origem",
  "Oferta",
  "Eventos",
  "Última atividade",
  "Valor da venda",
];

const STATUS_LABELS: Record<VisitorSummaryRow["status"], string> = {
  visitor: "Visitante",
  lead: "Lead",
  buyer: "Comprador",
  refunded: "Reembolsado",
};

export function VisitorsExportButton({ rows }: { rows: VisitorSummaryRow[] }) {
  function handleExport() {
    const lines = rows.map((row) => [
      row.visitorId,
      row.leadName,
      row.leadEmail,
      row.leadPhone,
      STATUS_LABELS[row.status],
      row.utmSource,
      row.offerName,
      row.eventCount,
      row.lastEventAt ?? row.lastSeenAt,
      row.saleValue,
    ]);
    downloadCsv(`visitantes-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(CSV_HEADERS, lines));
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
      Exportar CSV
    </Button>
  );
}
