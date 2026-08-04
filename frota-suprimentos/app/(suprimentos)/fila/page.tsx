import Link from "next/link";
import { Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/frota/status-badge";
import { SlaBadge } from "@/components/frota/sla-badge";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getFilaSuprimentos } from "@/lib/frota/queries";

export default async function FilaPage() {
  const configured = isSupabaseConfigured();
  const fila = configured ? await getFilaSuprimentos() : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fila de Solicitações</h1>
        <p className="text-sm text-muted-foreground">
          Ordenada pelo prazo de SLA mais urgente primeiro.
        </p>
      </div>

      {!configured ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Supabase não configurado — defina as variáveis de ambiente para ver
            solicitações reais (veja .env.example).
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Pendentes de resposta</CardTitle>
            <Badge variant="outline">{fila.length} na fila</Badge>
          </CardHeader>
          <CardContent>
            {fila.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Inbox className="size-8" />
                <p className="text-sm">Nenhuma solicitação pendente. Fila zerada.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SLA</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Família</TableHead>
                    <TableHead>Descrição / Referência</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fila.map((solicitacao) => (
                    <TableRow key={solicitacao.id} className="cursor-pointer">
                      <TableCell>
                        <Link
                          href={`/solicitacoes/${solicitacao.id}`}
                          className="block"
                        >
                          <SlaBadge slaLimite={solicitacao.sla_limite} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/solicitacoes/${solicitacao.id}`}
                          className="block font-medium text-foreground"
                        >
                          {solicitacao.unidade}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/solicitacoes/${solicitacao.id}`} className="block">
                          {solicitacao.familia_nome}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/solicitacoes/${solicitacao.id}`} className="block">
                          <p className="text-foreground">{solicitacao.descricao_curta}</p>
                          <p className="font-mono-nums text-xs text-muted-foreground">
                            Ref: {solicitacao.referencia_fabricante}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/solicitacoes/${solicitacao.id}`} className="block">
                          {solicitacao.solicitante_nome}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/solicitacoes/${solicitacao.id}`} className="block">
                          <StatusBadge status={solicitacao.status} />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
