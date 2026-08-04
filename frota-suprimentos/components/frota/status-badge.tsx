import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_VARIANT, STATUS_LABELS, type StatusSolicitacao } from "@/lib/frota/types";

export function StatusBadge({ status }: { status: StatusSolicitacao }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}
