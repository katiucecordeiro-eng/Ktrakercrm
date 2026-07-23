"use client";

import { useActionState } from "react";
import { History } from "lucide-react";

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
import { syncOfferSalesHistoryAction, type HotmartSyncActionState } from "./hotmart-sync-actions";

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function HotmartSyncDialog({ offerId }: { offerId: string }) {
  const action = syncOfferSalesHistoryAction.bind(null, offerId);
  const [state, formAction, isPending] = useActionState<HotmartSyncActionState, FormData>(
    action,
    undefined,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History /> Vendas retroativas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sincronizar vendas retroativas da Hotmart</DialogTitle>
          <DialogDescription>
            Busca vendas já existentes na Hotmart no período informado (para
            os produtos cadastrados nesta oferta) e importa para o CRM. Não
            dispara Purchase para Meta/GA4 — são vendas antigas, isso evitaria
            contagem duplicada e sinal fora da janela aceita pela Meta.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hotmart-since">De</Label>
              <Input id="hotmart-since" name="since" type="date" defaultValue={isoDaysAgo(365)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hotmart-until">Até</Label>
              <Input id="hotmart-until" name="until" type="date" defaultValue={isoDaysAgo(0)} required />
            </div>
          </div>
          {state?.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          {state?.success ? <p className="text-sm text-accent">{state.success}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
