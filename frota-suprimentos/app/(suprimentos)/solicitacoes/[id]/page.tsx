import { notFound } from "next/navigation";
import { CheckCircle2, Link2, PackagePlus, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/frota/status-badge";
import { SlaBadge } from "@/components/frota/sla-badge";
import { createClient } from "@/lib/supabase/server";
import { LADO_LABELS } from "@/lib/frota/types";
import { formatarData } from "@/lib/frota/format";
import {
  buscarItensSimilares,
  getSolicitacaoById,
  getUltimaDecisao,
} from "@/lib/frota/queries";
import { marcarEmAnalise } from "./actions";
import { DecisaoPanel } from "./decisao-panel";

const STATUS_ACIONAVEIS = ["pendente", "em_analise"];

const DECISAO_ICON = {
  vinculado_existente: Link2,
  aprovado_novo: PackagePlus,
  rejeitado: XCircle,
};

const DECISAO_LABEL = {
  vinculado_existente: "Vinculado a item existente",
  aprovado_novo: "Aprovado como item novo",
  rejeitado: "Rejeitado",
};

export default async function SolicitacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let solicitacao = await getSolicitacaoById(id);
  if (!solicitacao) notFound();

  if (solicitacao.status === "pendente") {
    await marcarEmAnalise(id);
    solicitacao = { ...solicitacao, status: "em_analise" };
  }

  const acionavel = STATUS_ACIONAVEIS.includes(solicitacao.status);

  const [itensSimilares, ultimaDecisao, fotoUrl] = await Promise.all([
    acionavel
      ? buscarItensSimilares({
          referencia: solicitacao.referencia_fabricante,
          descricao: solicitacao.descricao_curta,
          familiaId: solicitacao.familia_id,
        })
      : Promise.resolve([]),
    !acionavel ? getUltimaDecisao(id) : Promise.resolve(null),
    resolveFotoUrl(solicitacao.foto_url),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {solicitacao.descricao_curta}
          </h1>
          <p className="text-sm text-muted-foreground">
            {solicitacao.unidade} · Solicitado por {solicitacao.solicitante_nome} em{" "}
            {formatarData(solicitacao.data_solicitacao)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={solicitacao.status} />
          {acionavel ? <SlaBadge slaLimite={solicitacao.sla_limite} /> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detalhes da solicitação</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Campo label="Família" valor={solicitacao.familia_nome} />
              <Campo
                label="Referência do fabricante"
                valor={solicitacao.referencia_fabricante}
                mono
              />
              <Campo label="Aplicação / modelo" valor={solicitacao.aplicacao} />
              <Campo
                label="Lado"
                valor={solicitacao.lado ? LADO_LABELS[solicitacao.lado] : "Não aplicável"}
              />
              <Campo label="Unidade de medida" valor={solicitacao.unidade_medida} />
              <Campo label="Unidade solicitante" valor={solicitacao.unidade} />
            </dl>

            <div className="mt-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Foto anexada
              </p>
              {fotoUrl ? (
                <div className="h-48 w-full max-w-sm overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- domínio do bucket é dinâmico por projeto Supabase */}
                  <img
                    src={fotoUrl}
                    alt="Foto do item solicitado"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma foto anexada.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linha do tempo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Solicitado em</p>
              <p className="text-foreground">{formatarData(solicitacao.data_solicitacao)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Prazo de SLA</p>
              <p className="text-foreground">{formatarData(solicitacao.sla_limite)}</p>
            </div>
            {solicitacao.data_resposta ? (
              <div>
                <p className="text-muted-foreground">Respondido em</p>
                <p className="text-foreground">{formatarData(solicitacao.data_resposta)}</p>
              </div>
            ) : null}
            {solicitacao.responsavel_nome ? (
              <div>
                <p className="text-muted-foreground">Responsável (Suprimentos)</p>
                <p className="text-foreground">{solicitacao.responsavel_nome}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {acionavel ? (
        <DecisaoPanel
          solicitacao={solicitacao}
          familiaNome={solicitacao.familia_nome}
          itensSimilares={itensSimilares}
        />
      ) : (
        <DecisaoRegistradaCard decisao={ultimaDecisao} />
      )}
    </div>
  );
}

function Campo({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? "font-mono-nums text-sm text-foreground" : "text-sm text-foreground"}>
        {valor}
      </dd>
    </div>
  );
}

function DecisaoRegistradaCard({
  decisao,
}: {
  decisao: Awaited<ReturnType<typeof getUltimaDecisao>>;
}) {
  if (!decisao) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4" />
          Solicitação concluída, mas o registro de decisão não foi encontrado.
        </CardContent>
      </Card>
    );
  }

  const Icon = DECISAO_ICON[decisao.decisao];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decisão registrada</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-accent" />
          <span className="font-medium text-foreground">
            {DECISAO_LABEL[decisao.decisao]}
          </span>
        </div>
        {decisao.item_codigo_benner ? (
          <Badge variant="outline" className="w-fit font-mono-nums">
            {decisao.item_codigo_benner} — {decisao.item_nome_padronizado}
          </Badge>
        ) : null}
        {decisao.motivo ? (
          <p className="text-sm text-muted-foreground">&ldquo;{decisao.motivo}&rdquo;</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Por {decisao.responsavel_nome} em {formatarData(decisao.data)}
        </p>
      </CardContent>
    </Card>
  );
}

async function resolveFotoUrl(fotoPath: string | null): Promise<string | null> {
  if (!fotoPath) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("solicitacoes-fotos")
    .createSignedUrl(fotoPath, 3600);
  return data?.signedUrl ?? null;
}
