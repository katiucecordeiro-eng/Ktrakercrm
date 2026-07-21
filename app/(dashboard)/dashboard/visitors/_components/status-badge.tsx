import { Badge } from "@/components/ui/badge";
import type { VisitorStatus } from "@/lib/crm/types";

const STATUS_CONFIG: Record<VisitorStatus, { label: string; variant: "default" | "warning" | "destructive" | "secondary" }> = {
  buyer: { label: "Comprador", variant: "default" },
  refunded: { label: "Reembolsado", variant: "destructive" },
  lead: { label: "Lead", variant: "warning" },
  visitor: { label: "Visitante", variant: "secondary" },
};

export function StatusBadge({ status }: { status: VisitorStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
