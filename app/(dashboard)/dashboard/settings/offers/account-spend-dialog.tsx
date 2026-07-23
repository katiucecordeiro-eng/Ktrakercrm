"use client";

import { useActionState } from "react";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { getMetaAccountSpend, type AccountInfoState } from "./test-actions";

export function AccountSpendDialog({ offerId }: { offerId: string }) {
  const action = getMetaAccountSpend.bind(null, offerId);
  const [state, formAction, isPending] = useActionState<AccountInfoState, FormData>(
    action,
    undefined,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Wallet /> Saldo Meta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gasto total da conta Meta</DialogTitle>
          <DialogDescription>
            Total gasto historicamente e saldo/valor devido na conta de anúncio —
            direto da Graph API, fora da granularidade diária do sync de gasto.
            Útil para conferir o ROI real considerando tudo que já saiu da conta.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          {state?.data ? (
            <div className="grid grid-cols-2 gap-4 rounded-md border border-border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Total gasto (histórico)</p>
                <p className="font-mono-nums text-lg text-foreground">
                  {formatCurrency(state.data.amountSpent, state.data.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo / valor devido</p>
                <p className="font-mono-nums text-lg text-foreground">
                  {formatCurrency(state.data.balance, state.data.currency)}
                </p>
              </div>
              {state.data.spendCap != null ? (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Limite de gasto da conta</p>
                  <p className="font-mono-nums text-sm text-foreground">
                    {formatCurrency(state.data.spendCap, state.data.currency)}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            A Graph API não tem um campo separado de impostos da conta — isso só
            aparece no detalhamento de fatura em Gerenciador de Anúncios →
            Faturamento. Os valores acima são antes de eventuais impostos
            cobrados na fatura.
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Buscando..." : "Buscar saldo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
