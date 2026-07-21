import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getVisitorProfile } from "@/lib/crm/queries";
import { formatCurrency } from "@/lib/format";

import { EventTimeline } from "./_components/event-timeline";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={`max-w-[65%] truncate text-right text-foreground ${mono ? "font-mono-nums text-xs" : ""}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export default async function VisitorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure o Supabase para ver o perfil do visitante.
      </p>
    );
  }

  const { id } = await params;
  const supabase = await createClient();
  const { visitor, events, sales, leads } = await getVisitorProfile(supabase, id);

  if (!visitor) notFound();

  const lead = leads[0] ?? null;
  const location = [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/visitors"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{lead?.name || lead?.email || "Visitante anônimo"}</CardTitle>
            <CardDescription className="font-mono-nums">{visitor.id}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow label="E-mail" value={lead?.email} />
            <InfoRow label="Telefone" value={lead?.phone} />
            <InfoRow label="Local" value={location} />
            <InfoRow label="Origem" value={visitor.utm_source} />
            <InfoRow label="Mídia" value={visitor.utm_medium} />
            <InfoRow label="Campanha" value={visitor.utm_campaign} />
            <InfoRow label="Primeiro acesso" value={formatDateTime(visitor.first_seen_at)} />
            <InfoRow label="Última atividade" value={formatDateTime(visitor.last_seen_at)} />
            <InfoRow label="Landing page" value={visitor.landing_page} mono />
            <InfoRow label="Referrer" value={visitor.referrer} mono />
            <InfoRow label="Dispositivo" value={visitor.device_type} />
            <InfoRow label="IP" value={visitor.ip} mono />
            <InfoRow label="User agent" value={visitor.user_agent} mono />
            <InfoRow label="fbp" value={visitor.fbp} mono />
            <InfoRow label="fbc" value={visitor.fbc} mono />
            <InfoRow label="ga_client_id" value={visitor.ga_client_id} mono />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {sales.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Vendas</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {sale.product_name ?? sale.hotmart_transaction_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.payment_method ?? "—"} · {formatDateTime(sale.approved_at ?? sale.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono-nums text-accent">
                        {formatCurrency(sale.gross_value ?? 0, sale.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{sale.status}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Histórico de eventos</CardTitle>
              <CardDescription>
                Clique num evento para ver o payload enviado à Meta e a resposta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventTimeline events={events} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
