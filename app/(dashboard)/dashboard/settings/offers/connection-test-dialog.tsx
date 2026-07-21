"use client";

import { useActionState } from "react";
import { PlugZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { testMetaCapi, testMarketingApi, type TestActionState } from "./test-actions";

function TestButton({
  label,
  action,
}: {
  label: string;
  action: (state: TestActionState, formData: FormData) => Promise<TestActionState>;
}) {
  const [state, formAction, isPending] = useActionState<TestActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Testando..." : "Testar"}
        </Button>
      </div>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state?.success ? <p className="text-xs text-accent">{state.success}</p> : null}
    </form>
  );
}

export function ConnectionTestDialog({ offerId }: { offerId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlugZap /> Diagnóstico
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Testar conexões</DialogTitle>
          <DialogDescription>
            Envia uma chamada real para confirmar que as credenciais desta oferta
            estão corretas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <TestButton label="Meta Conversions API" action={testMetaCapi.bind(null, offerId)} />
          <TestButton label="Meta Marketing API (gasto)" action={testMarketingApi.bind(null, offerId)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
