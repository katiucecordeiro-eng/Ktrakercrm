import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLACEHOLDER_KPIS = [
  "Faturamento bruto",
  "ROAS",
  "Lucro",
  "CPA",
  "Ticket médio",
  "Taxa de reembolso",
];

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">
          KPIs, funil e gráficos em tempo real chegam na Sprint 5. Por enquanto,
          cadastre suas ofertas em Configurações.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {PLACEHOLDER_KPIS.map((label) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-mono-nums text-2xl font-semibold text-muted-foreground">
                —
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
