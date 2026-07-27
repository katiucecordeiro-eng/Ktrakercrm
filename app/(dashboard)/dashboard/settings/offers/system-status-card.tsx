import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSystemStatus } from "@/lib/system-status";

export function SystemStatusCard() {
  const { checks, operational } = getSystemStatus();
  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Diagnóstico do sistema</CardTitle>
          <CardDescription>
            Confere só a presença de cada variável de ambiente crítica — nunca o valor.
          </CardDescription>
        </div>
        <Badge variant={operational ? "default" : "destructive"}>
          {operational ? "Sistema 100% operacional" : "Itens pendentes"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Obrigatórias</p>
          <div className="flex flex-col gap-1.5">
            {required.map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Opcionais (com fallback quando ausentes)
          </p>
          <div className="flex flex-col gap-1.5">
            {optional.map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckRow({ check }: { check: { key: string; label: string; present: boolean } }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {check.present ? (
        <CheckCircle2 className="size-4 shrink-0 text-accent" />
      ) : (
        <XCircle className="size-4 shrink-0 text-danger" />
      )}
      <span className={check.present ? "text-foreground" : "text-muted-foreground"}>{check.label}</span>
      <code className="font-mono-nums text-xs text-muted-foreground">{check.key}</code>
    </div>
  );
}
