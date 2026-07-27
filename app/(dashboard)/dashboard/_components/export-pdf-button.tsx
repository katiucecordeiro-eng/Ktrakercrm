"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

// "Exportar PDF" via impressão do navegador (window.print + CSS de
// impressão dedicado) em vez de uma lib de geração de PDF no servidor —
// mais simples, sem dependência nova, e o usuário já escolhe "Salvar como
// PDF" no diálogo de impressão do navegador.
export function ExportPdfButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
      <FileDown /> Exportar PDF
    </Button>
  );
}
