"use client";

import { useActionState, useState } from "react";

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
import { Switch } from "@/components/ui/switch";
import type { Offer } from "@/lib/types/offer";
import { createOffer, updateOffer, type OfferActionState } from "./actions";

export function OfferFormDialog({
  offer,
  trigger,
}: {
  offer?: Offer;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(offer?.active ?? true);
  const action = offer ? updateOffer.bind(null, offer.id) : createOffer;
  const [state, formAction, isPending] = useActionState<OfferActionState, FormData>(
    action,
    undefined,
  );

  // Fecha o dialog quando a action termina com sucesso — ajustado durante a
  // renderização (em vez de um efeito) para evitar um render em cascata.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.success && open) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{offer ? "Editar oferta" : "Nova oferta"}</DialogTitle>
          <DialogDescription>
            Cada oferta tem seu próprio domínio, Pixel Meta, tokens e produtos
            Hotmart. Segredos (tokens) ficam em variáveis de ambiente — aqui
            você só guarda a referência do nome da env var.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome" name="name" defaultValue={offer?.name} required />
            <Field
              label="Slug"
              name="slug"
              defaultValue={offer?.slug}
              placeholder="minha-oferta"
              required
            />
          </div>
          <Field
            label="Domínio"
            name="domain"
            defaultValue={offer?.domain ?? ""}
            placeholder="www.minhaoferta.com"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Meta Pixel ID"
              name="meta_pixel_id"
              defaultValue={offer?.meta_pixel_id ?? ""}
            />
            <Field
              label="Env var do token CAPI"
              name="meta_capi_token_ref"
              defaultValue={offer?.meta_capi_token_ref ?? ""}
              placeholder="META_CAPI_TOKEN_OFERTA1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="GA4 Measurement ID"
              name="ga4_measurement_id"
              defaultValue={offer?.ga4_measurement_id ?? ""}
            />
            <Field
              label="Env var do GA4 API secret"
              name="ga4_api_secret_ref"
              defaultValue={offer?.ga4_api_secret_ref ?? ""}
              placeholder="GA4_API_SECRET_OFERTA1"
            />
          </div>
          <Field
            label="Produtos Hotmart (IDs separados por vírgula)"
            name="hotmart_product_ids"
            defaultValue={offer?.hotmart_product_ids?.join(", ") ?? ""}
            placeholder="123456, 789012"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Moeda"
              name="currency"
              defaultValue={offer?.currency ?? "BRL"}
            />
            <Field
              label="Imposto (%)"
              name="tax_rate"
              type="number"
              step="0.01"
              defaultValue={offer?.tax_rate ?? 0}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Oferta ativa</Label>
            <input type="hidden" name="active" value={active ? "true" : "false"} />
          </div>
          {state?.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  type = "text",
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
