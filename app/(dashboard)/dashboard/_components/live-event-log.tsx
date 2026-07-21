"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveIndicator } from "@/components/layout/live-indicator";
import { createClient } from "@/lib/supabase/client";

type LiveEvent = {
  id: string;
  event_name: string;
  utm_campaign: string | null;
  offer_id: string;
  created_at: string;
};

export function LiveEventLog({
  offerId,
  offerNames,
  supabaseConfigured,
}: {
  offerId: string | null;
  offerNames: Record<string, string>;
  supabaseConfigured: boolean;
}) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;

    const supabase = createClient();
    const channel = supabase
      .channel("events-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          ...(offerId ? { filter: `offer_id=eq.${offerId}` } : {}),
        },
        (payload) => {
          const row = payload.new as LiveEvent;
          setEvents((prev) => [row, ...prev].slice(0, 20));
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      setConnected(false);
      supabase.removeChannel(channel);
    };
  }, [offerId, supabaseConfigured]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Log de eventos ao vivo</CardTitle>
          <CardDescription>Stream em tempo real via Supabase Realtime.</CardDescription>
        </div>
        <LiveIndicator connected={connected} />
      </CardHeader>
      <CardContent className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {supabaseConfigured
              ? "Aguardando eventos..."
              : "Configure o Supabase para ativar o Realtime."}
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0"
            >
              <span className="font-medium text-foreground">{event.event_name}</span>
              <span className="truncate text-muted-foreground">
                {offerNames[event.offer_id] ?? event.offer_id}
              </span>
              <span className="truncate font-mono-nums text-xs text-muted-foreground">
                {event.utm_campaign ?? "—"}
              </span>
              <span className="shrink-0 font-mono-nums text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleTimeString("pt-BR")}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
