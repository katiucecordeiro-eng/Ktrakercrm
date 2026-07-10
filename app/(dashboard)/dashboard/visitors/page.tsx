import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function VisitorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">CRM / Visitantes</h1>
        <p className="text-sm text-muted-foreground">
          Tabela de visitantes/leads e perfil com timeline de eventos chegam na
          Sprint 6, depois que o tracking (Sprint 2) e os webhooks Hotmart
          (Sprint 3) estiverem enviando dados reais.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
          <CardDescription>
            Busca por e-mail/origem, status (visitante, lead, comprador,
            reembolsado) e perfil detalhado com payloads enviados à Meta.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
