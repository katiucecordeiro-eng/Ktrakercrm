import { Badge } from "@/components/ui/badge";
import { SLA_BADGE_VARIANT, formatarPrazoSla, slaEstado } from "@/lib/frota/sla";

export function SlaBadge({ slaLimite }: { slaLimite: string }) {
  const estado = slaEstado(slaLimite);
  return (
    <Badge variant={SLA_BADGE_VARIANT[estado]}>{formatarPrazoSla(slaLimite)}</Badge>
  );
}
