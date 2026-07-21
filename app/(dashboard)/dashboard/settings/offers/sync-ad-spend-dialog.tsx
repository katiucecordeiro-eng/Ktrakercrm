"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

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
import { syncOfferAdSpendAction, type SyncActionState } from "./sync-actions";

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function SyncAdSpendDialog({ offerId }: { offerId: string }) {
  const action = syncOfferAdSpendAction.bind(null, offerId);
  const [state, formAction, isPending] = useActionState<SyncActionState, FormData>(
    action,
    undefined,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw /> Sincronizar gasto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sincronizar gasto da Meta</DialogTitle>
          <DialogDescription>
            Busca spend/impressões/cliques por campanha, conjunto e anúncio no
            período informado (backfill manual). O cron automático roda a
            cada hora e resincroniza os últimos 3 dias.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="since">De</Label>
              <Input id="since" name="since" type="date" defaultValue={isoDaysAgo(7)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="until">Até</Label>
              <Input id="until" name="until" type="date" defaultValue={isoDaysAgo(0)} required />
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
