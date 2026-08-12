"use client";

import { useActionState } from "react";
import { Pause, Play, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  toggleCampaignStatusAction,
  updateCampaignBudgetAction,
  type CampaignActionState,
} from "../campaign-actions";

type Level = "campaign" | "adset" | "ad";

function StatusForm({
  offerId,
  level,
  entityId,
  entityName,
  status,
  label,
  icon,
}: {
  offerId: string;
  level: Level;
  entityId: string;
  entityName: string;
  status: "ACTIVE" | "PAUSED";
  label: string;
  icon: React.ReactNode;
}) {
  const boundAction = toggleCampaignStatusAction.bind(null, offerId, level, entityId, entityName, status);
  const [state, formAction, isPending] = useActionState<CampaignActionState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Button type="submit" variant="outline" size="sm" disabled={isPending} className="justify-start">
        {icon}
        {isPending ? "Enviando..." : label}
      </Button>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.success ? <p className="text-xs text-accent">{state.success}</p> : null}
    </form>
  );
}

function BudgetForm({
  offerId,
  level,
  entityId,
  entityName,
  currency,
}: {
  offerId: string;
  level: "campaign" | "adset";
  entityId: string;
  entityName: string;
  currency: string;
}) {
  const boundAction = updateCampaignBudgetAction.bind(null, offerId, level, entityId, entityName, currency);
  const [state, formAction, isPending] = useActionState<CampaignActionState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border pt-3">
      <Label htmlFor={`daily-budget-${entityId}`}>Novo orçamento diário ({currency})</Label>
      <div className="flex gap-2">
        <Input
          id={`daily-budget-${entityId}`}
          name="dailyBudget"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="ex.: 100.00"
          required
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.success ? <p className="text-xs text-accent">{state.success}</p> : null}
    </form>
  );
}

// Ações reais na conta de anúncio da Meta (gasta/pausa dinheiro de
// verdade) — por isso ficam atrás de um Dialog em vez de botões soltos na
// linha da tabela: abrir o diálogo é inofensivo, só o clique explícito no
// botão de dentro (Ativar/Pausar/Salvar) de fato dispara a chamada.
export function CampaignActionsCell({
  offerId,
  level,
  entityId,
  entityName,
  currency,
}: {
  offerId: string;
  level: Level;
  entityId: string;
  entityName: string;
  currency: string;
}) {
  // "sem-conjunto"/"sem-anuncio" são placeholders internos (gasto sem
  // adset_id/ad_id no payload da Meta) — não são IDs reais gerenciáveis.
  if (!offerId || entityId.startsWith("sem-")) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Gerenciar ${entityName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Settings2 className="size-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="truncate">{entityName}</DialogTitle>
          <DialogDescription>
            Ação direta na conta de anúncio da Meta — some/pausa {level === "campaign" ? "a campanha" : level === "adset" ? "o conjunto" : "o anúncio"} de verdade.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <StatusForm
            offerId={offerId}
            level={level}
            entityId={entityId}
            entityName={entityName}
            status="ACTIVE"
            label="Ativar"
            icon={<Play className="size-3.5" />}
          />
          <StatusForm
            offerId={offerId}
            level={level}
            entityId={entityId}
            entityName={entityName}
            status="PAUSED"
            label="Pausar"
            icon={<Pause className="size-3.5" />}
          />
        </div>

        {level !== "ad" ? (
          <BudgetForm
            offerId={offerId}
            level={level}
            entityId={entityId}
            entityName={entityName}
            currency={currency}
          />
        ) : null}

        <DialogFooter>
          <p className="text-xs text-muted-foreground">
            Orçamento só existe em campanha (CBO) ou conjunto (ABO) — a Meta rejeita se você usar o
            nível errado pra essa conta.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
