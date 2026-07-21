"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { VisitorEventRow } from "@/lib/crm/types";

function statusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

export function EventTimeline({ events }: { events: VisitorEventRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {events.map((event, index) => {
        const isOpen = expanded.has(event.id);
        return (
          <div key={event.id} className="relative flex gap-3 pb-4 pl-2">
            {index < events.length - 1 ? (
              <span className="absolute left-[9px] top-5 h-full w-px bg-border" />
            ) : null}
            <span className="relative z-10 mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => toggle(event.id)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {event.event_name}
                  {event.utm_campaign ? (
                    <span className="font-mono-nums text-xs text-muted-foreground">
                      {event.utm_campaign}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString("pt-BR")}
                  {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </span>
              </button>
              {isOpen ? (
                <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-xs">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(event.meta_status)}>Meta: {event.meta_status}</Badge>
                    <Badge variant={statusVariant(event.ga4_status)}>GA4: {event.ga4_status}</Badge>
                  </div>
                  {event.page_url ? (
                    <p className="truncate text-muted-foreground">URL: {event.page_url}</p>
                  ) : null}
                  {event.meta_response ? (
                    <pre className="overflow-x-auto rounded bg-surface p-2 font-mono-nums text-[11px] text-muted-foreground">
                      {JSON.stringify(event.meta_response, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground">
                      Sem payload de resposta da Meta registrado para este evento.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
