"use client";

import { useActionState } from "react";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleOfferActiveAction, type OfferActionState } from "./actions";

// Pausa/reativa a oferta com um único clique — sem diálogo de confirmação,
// de propósito: é uma ação totalmente reversível (clicar de novo volta ao
// estado anterior), e o pedido era justamente não precisar de mais passos
// pra parar o tracking rápido enquanto investiga um problema.
export function OfferActiveToggleButton({ offerId, active }: { offerId: string; active: boolean }) {
  const boundAction = toggleOfferActiveAction.bind(null, offerId, !active);
  const [state, formAction, isPending] = useActionState<OfferActionState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {isPending ? "..." : active ? "Pausar" : "Ativar"}
      </Button>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
