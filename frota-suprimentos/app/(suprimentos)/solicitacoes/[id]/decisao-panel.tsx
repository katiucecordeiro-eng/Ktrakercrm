"use client";

import { useActionState, useState } from "react";
import { Link2, PackagePlus, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { gerarNomePadrao } from "@/lib/frota/nome-padrao";
import type { ItemSimilar, SolicitacaoComRelacoes } from "@/lib/frota/types";
import {
  aprovarComoNovo,
  rejeitarSolicitacao,
  vincularItemExistente,
  type DecisaoState,
} from "./actions";

type Modo = "vincular" | "aprovar" | "rejeitar" | null;

export function DecisaoPanel({
  solicitacao,
  familiaNome,
  itensSimilares,
}: {
  solicitacao: SolicitacaoComRelacoes;
  familiaNome: string;
  itensSimilares: ItemSimilar[];
}) {
  const [modo, setModo] = useState<Modo>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decisão do Suprimentos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={modo === "vincular" ? "default" : "outline"}
            onClick={() => setModo(modo === "vincular" ? null : "vincular")}
          >
            <Link2 /> Vincular a item existente
          </Button>
          <Button
            type="button"
            variant={modo === "aprovar" ? "default" : "outline"}
            onClick={() => setModo(modo === "aprovar" ? null : "aprovar")}
          >
            <PackagePlus /> Aprovar como item novo
          </Button>
          <Button
            type="button"
            variant={modo === "rejeitar" ? "destructive" : "ghost"}
            onClick={() => setModo(modo === "rejeitar" ? null : "rejeitar")}
          >
            <XCircle /> Rejeitar
          </Button>
        </div>

        {modo === "vincular" ? (
          <VincularForm solicitacaoId={solicitacao.id} itensSimilares={itensSimilares} />
        ) : null}
        {modo === "aprovar" ? (
          <AprovarForm solicitacao={solicitacao} familiaNome={familiaNome} />
        ) : null}
        {modo === "rejeitar" ? <RejeitarForm solicitacaoId={solicitacao.id} /> : null}
      </CardContent>
    </Card>
  );
}

function ErrorText({ state }: { state: DecisaoState }) {
  if (!state?.error) return null;
  return (
    <p className="text-sm text-danger" role="alert">
      {state.error}
    </p>
  );
}

function VincularForm({
  solicitacaoId,
  itensSimilares,
}: {
  solicitacaoId: string;
  itensSimilares: ItemSimilar[];
}) {
  const [state, formAction, isPending] = useActionState<DecisaoState, FormData>(
    vincularItemExistente,
    undefined,
  );
  const [itemId, setItemId] = useState<string>("");

  if (itensSimilares.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
        Nenhum item similar foi encontrado no catálogo padrão para vincular.
        Considere aprovar como item novo.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
      <input type="hidden" name="solicitacaoId" value={solicitacaoId} />
      <input type="hidden" name="itemId" value={itemId} />

      <div className="flex flex-col gap-2">
        {itensSimilares.map((item) => (
          <label
            key={item.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              itemId === item.id
                ? "border-accent bg-accent/10"
                : "border-border hover:bg-surface-hover",
            )}
          >
            <input
              type="radio"
              name="item-radio"
              className="mt-1"
              checked={itemId === item.id}
              onChange={() => setItemId(item.id)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono-nums text-sm font-bold text-foreground">
                  {item.codigo_benner}
                </span>
                <Badge variant={item.match_tipo === "referencia_exata" ? "default" : "secondary"}>
                  {item.match_tipo === "referencia_exata"
                    ? "Referência exata"
                    : "Similaridade textual"}
                </Badge>
                <span className="font-mono-nums text-xs text-muted-foreground">
                  score {item.score.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-foreground">{item.nome_padronizado}</p>
              {item.ncm_cest ? (
                <p className="text-xs text-muted-foreground">NCM/CEST: {item.ncm_cest}</p>
              ) : null}
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="motivo-vincular">Observação (opcional)</Label>
        <Textarea
          id="motivo-vincular"
          name="motivo"
          placeholder="Ex.: mesma peça, referência confirmada com o fabricante."
        />
      </div>

      <ErrorText state={state} />

      <Button type="submit" disabled={isPending || !itemId} className="self-start">
        {isPending ? "Vinculando..." : "Confirmar vínculo"}
      </Button>
    </form>
  );
}

function AprovarForm({
  solicitacao,
  familiaNome,
}: {
  solicitacao: SolicitacaoComRelacoes;
  familiaNome: string;
}) {
  const [state, formAction, isPending] = useActionState<DecisaoState, FormData>(
    aprovarComoNovo,
    undefined,
  );

  const nomeSugerido = gerarNomePadrao({
    familiaNome,
    descricaoCurta: solicitacao.descricao_curta,
    aplicacao: solicitacao.aplicacao,
    lado: solicitacao.lado,
  });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <input type="hidden" name="solicitacaoId" value={solicitacao.id} />
      <input type="hidden" name="familiaId" value={solicitacao.familia_id} />
      <input
        type="hidden"
        name="referenciaFabricante"
        value={solicitacao.referencia_fabricante}
      />
      <input type="hidden" name="aplicacao" value={solicitacao.aplicacao} />
      {solicitacao.lado ? <input type="hidden" name="lado" value={solicitacao.lado} /> : null}

      <p className="text-xs text-muted-foreground">
        Cadastre este item primeiro no Benner — os campos abaixo são o espelho
        interno, para o catálogo padrão e a atribuição do código à solicitação.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="codigoBenner">Código Benner *</Label>
          <Input id="codigoBenner" name="codigoBenner" required placeholder="Ex.: 000123" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ncmCest">NCM/CEST</Label>
          <Input id="ncmCest" name="ncmCest" placeholder="Ex.: 8708.30.90" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nomePadronizado">Nome padronizado *</Label>
        <Input
          id="nomePadronizado"
          name="nomePadronizado"
          required
          defaultValue={nomeSugerido}
        />
        <p className="text-xs text-muted-foreground">
          Sugerido a partir de família, descrição e aplicação — edite se necessário.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="unidadeMedida">Unidade de medida *</Label>
        <Input
          id="unidadeMedida"
          name="unidadeMedida"
          required
          defaultValue={solicitacao.unidade_medida}
        />
      </div>

      <ErrorText state={state} />

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Cadastrando..." : "Aprovar e cadastrar no catálogo padrão"}
      </Button>
    </form>
  );
}

function RejeitarForm({ solicitacaoId }: { solicitacaoId: string }) {
  const [state, formAction, isPending] = useActionState<DecisaoState, FormData>(
    rejeitarSolicitacao,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border border-danger/30 bg-danger/5 p-4"
    >
      <input type="hidden" name="solicitacaoId" value={solicitacaoId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="motivo-rejeitar">Motivo da rejeição *</Label>
        <Textarea
          id="motivo-rejeitar"
          name="motivo"
          required
          placeholder="Ex.: referência do fabricante inválida, dados insuficientes."
        />
      </div>
      <ErrorText state={state} />
      <Button type="submit" variant="destructive" disabled={isPending} className="self-start">
        {isPending ? "Rejeitando..." : "Confirmar rejeição"}
      </Button>
    </form>
  );
}
