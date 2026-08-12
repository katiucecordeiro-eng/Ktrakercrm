import type { LucideIcon } from "lucide-react";
import { MousePointerClick, Eye, FileText, CreditCard, ShoppingBag, CheckCircle2, RotateCcw } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { VisitorEventRow, VisitorSaleRow } from "@/lib/crm/types";

type Milestone = {
  label: string;
  icon: LucideIcon;
  at: string;
  tone: "default" | "accent" | "destructive";
};

function formatGap(ms: number): string {
  if (ms < 0) return "—";
  const minutes = ms / 60000;
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours * 10) / 10} h`;
  const days = hours / 24;
  return `${Math.round(days * 10) / 10} dia${days >= 1.5 ? "s" : ""}`;
}

function formatMoment(value: string) {
  return formatDateTime(value);
}

function firstEventAt(events: VisitorEventRow[], name: string): string | null {
  const match = events.find((event) => event.event_name === name);
  return match?.created_at ?? null;
}

function buildMilestones(events: VisitorEventRow[], sales: VisitorSaleRow[]): Milestone[] {
  // events chega em ordem decrescente (mais recente primeiro) do getVisitorProfile.
  const ascending = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const milestones: Milestone[] = [];

  const firstContact = ascending[0]?.created_at ?? null;
  if (firstContact) {
    milestones.push({ label: "Primeiro contato", icon: MousePointerClick, at: firstContact, tone: "default" });
  }

  const pageView = firstEventAt(ascending, "PageView");
  if (pageView && pageView !== firstContact) {
    milestones.push({ label: "Visualizou a página", icon: Eye, at: pageView, tone: "default" });
  }

  const viewContent = firstEventAt(ascending, "ViewContent");
  if (viewContent) {
    milestones.push({ label: "Visualizou conteúdo", icon: FileText, at: viewContent, tone: "default" });
  }

  const initiateCheckout = firstEventAt(ascending, "InitiateCheckout");
  if (initiateCheckout) {
    milestones.push({ label: "Iniciou checkout", icon: CreditCard, at: initiateCheckout, tone: "accent" });
  }

  const sortedSales = [...sales].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const firstSale = sortedSales[0] ?? null;
  if (firstSale) {
    milestones.push({ label: "Venda iniciada", icon: ShoppingBag, at: firstSale.created_at, tone: "default" });
  }

  const approvedSale = sortedSales.find((sale) => sale.status === "approved" && sale.approved_at);
  if (approvedSale?.approved_at) {
    milestones.push({ label: "Venda aprovada", icon: CheckCircle2, at: approvedSale.approved_at, tone: "accent" });
  }

  const refundedSale = sortedSales.find(
    (sale) => (sale.status === "refunded" || sale.status === "chargeback") && sale.refunded_at,
  );
  if (refundedSale?.refunded_at) {
    milestones.push({ label: "Reembolso", icon: RotateCcw, at: refundedSale.refunded_at, tone: "destructive" });
  }

  return milestones.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

const TONE_CLASSES: Record<Milestone["tone"], string> = {
  default: "bg-primary/15 text-foreground",
  accent: "bg-accent/15 text-accent",
  destructive: "bg-destructive/15 text-destructive",
};

export function JourneyTimeline({
  events,
  sales,
}: {
  events: VisitorEventRow[];
  sales: VisitorSaleRow[];
}) {
  const milestones = buildMilestones(events, sales);

  if (milestones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ainda não há jornada suficiente para exibir.</p>
    );
  }

  return (
    <div className="flex w-full items-start overflow-x-auto pb-1">
      {milestones.map((milestone, index) => {
        const Icon = milestone.icon;
        const previous = milestones[index - 1];
        const gap = previous
          ? formatGap(new Date(milestone.at).getTime() - new Date(previous.at).getTime())
          : null;
        return (
          <div key={`${milestone.label}-${milestone.at}`} className="flex items-start">
            {index > 0 ? (
              <div className="flex w-16 shrink-0 flex-col items-center pt-4 sm:w-24">
                <span className="h-px w-full bg-border" />
                {gap ? (
                  <span className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">+{gap}</span>
                ) : null}
              </div>
            ) : null}
            <div className="flex w-24 shrink-0 flex-col items-center gap-1.5 text-center sm:w-28">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[milestone.tone]}`}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-xs font-medium text-foreground">{milestone.label}</span>
              <span className="font-mono-nums text-[11px] text-muted-foreground">
                {formatMoment(milestone.at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
