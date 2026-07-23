"use client";

import { useActionState } from "react";
import { PlugZap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testMetaCapi, testMarketingApi, type TestActionState } from "./test-actions";
import { testTrackIngestion, type TrackTestState } from "./track-test-actions";

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

function TrackIngestionTest({ offerId, slug }: { offerId: string; slug: string }) {
  const action = testTrackIngestion.bind(null, offerId);
  const [state, formAction, isPending] = useActionState<TrackTestState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          Rastreamento (/api/track) — funil zerado?
        </span>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Testando..." : "Testar"}
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="track-test-slug" className="text-xs text-muted-foreground">
          Slug testado (confira se bate com o data-offer da página ao vivo)
        </Label>
        <Input id="track-test-slug" name="slug" defaultValue={slug} className="h-8 text-xs" />
      </div>
      {state?.offerSlug ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          No banco: slug <code className="font-mono-nums">{state.offerSlug}</code>{" "}
          <Badge variant={state.offerActive ? "default" : "secondary"}>
            {state.offerActive ? "Ativa" : "Inativa"}
          </Badge>
        </p>
      ) : null}
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state?.success ? <p className="text-xs text-accent">{state.success}</p> : null}
    </form>
  );
}

export function ConnectionTestDialog({ offerId, slug }: { offerId: string; slug: string }) {
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
          <TrackIngestionTest offerId={offerId} slug={slug} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
