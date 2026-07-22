import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { searchVisitors } from "@/lib/crm/queries";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Offer } from "@/lib/types/offer";
import type { RawSearchParams } from "@/lib/reports/filters";

import { VisitorsSearch } from "./_components/visitors-search";
import { StatusBadge } from "./_components/status-badge";

const PAGE_SIZE = 25;

async function getOffers(): Promise<Offer[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("offers").select("*").order("created_at", { ascending: true });
    return (data as Offer[]) ?? [];
  } catch {
    return [];
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const configured = isSupabaseConfigured();
  const offers = await getOffers();
  const resolved = await searchParams;

  const offerSlug = typeof resolved.offer === "string" ? resolved.offer : null;
  const offer = offerSlug ? (offers.find((o) => o.slug === offerSlug) ?? null) : null;
  const search = typeof resolved.q === "string" ? resolved.q : "";
  const page = Math.max(1, Number(resolved.page) || 1);

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">CRM / Visitantes</h1>
          <p className="text-sm text-muted-foreground">
            Configure o Supabase para ver visitantes, leads e compradores reais.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { rows, total } = await searchVisitors(
    supabase,
    { offerId: offer?.id ?? null, search, page, pageSize: PAGE_SIZE },
    offers,
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (offerSlug) params.set("offer", offerSlug);
    if (search) params.set("q", search);
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">CRM / Visitantes</h1>
          <p className="text-sm text-muted-foreground">
            {formatNumber(total)} visitante(s){offer ? ` em ${offer.name}` : ""}.
          </p>
        </div>
        <VisitorsSearch defaultValue={search} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visitantes, leads e compradores</CardTitle>
          <CardDescription>
            Clique numa linha para ver o perfil completo com timeline de eventos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum visitante encontrado{search ? " para essa busca" : ""}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Última atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.visitorId} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/dashboard/visitors/${row.visitorId}`} className="block hover:underline">
                        <span className="font-medium text-foreground">
                          {row.leadName || row.leadEmail || "Visitante anônimo"}
                        </span>
                        <br />
                        <span className="font-mono-nums text-xs text-muted-foreground">
                          {row.leadEmail ?? row.visitorId.slice(0, 8)}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.utmSource || "direto/orgânico"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="font-mono-nums">{formatNumber(row.eventCount)}</TableCell>
                    <TableCell className="font-mono-nums text-xs text-muted-foreground">
                      {formatDateTime(row.lastEventAt ?? row.lastSeenAt)}
                      {row.saleValue ? (
                        <span className="ml-2 text-accent">{formatCurrency(row.saleValue)}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
              {page > 1 ? <Link href={pageHref(page - 1)}>Anterior</Link> : <span>Anterior</span>}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
              {page < totalPages ? <Link href={pageHref(page + 1)}>Próxima</Link> : <span>Próxima</span>}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
