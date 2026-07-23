"use client";

import { useActionState, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

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

type SafeOffer = Omit<Offer, "meta_capi_token" | "meta_ads_token" | "ga4_api_secret">;

type MaskedSecrets = {
  metaCapiToken: string | null;
  metaAdsToken: string | null;
  ga4ApiSecret: string | null;
};

export function OfferFormDialog({
  offer,
  maskedSecrets,
  trigger,
}: {
  offer?: SafeOffer;
  maskedSecrets?: MaskedSecrets;
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
            Hotmart. Tokens ficam criptografados no banco — cole o valor
            direto do Meta/GA4; deixe em branco para manter o que já está
            salvo.
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
            <SecretField
              label="Token CAPI da Meta"
              name="meta_capi_token"
              masked={maskedSecrets?.metaCapiToken}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Meta Ad Account ID (gasto de anúncios)"
              name="meta_ad_account_id"
              defaultValue={offer?.meta_ad_account_id ?? ""}
              placeholder="act_1234567890 ou 1234567890"
            />
            <SecretField
              label="Token da Marketing API"
              name="meta_ads_token"
              masked={maskedSecrets?.metaAdsToken}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="GA4 Measurement ID"
              name="ga4_measurement_id"
              defaultValue={offer?.ga4_measurement_id ?? ""}
            />
            <SecretField
              label="GA4 API secret"
              name="ga4_api_secret"
              masked={maskedSecrets?.ga4ApiSecret}
            />
          </div>
          <ProductIdsField defaultValue={offer?.hotmart_product_ids ?? []} />
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

function ProductIdsField({ defaultValue }: { defaultValue: string[] }) {
  const [products, setProducts] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function addFromDraft() {
    const id = draft.trim();
    if (!id) return;
    setProducts((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addFromDraft();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="hotmart_product_ids_draft">Produtos Hotmart</Label>
      <div className="flex gap-2">
        <Input
          id="hotmart_product_ids_draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ID do produto (Enter para adicionar)"
        />
        <Button type="button" variant="secondary" onClick={addFromDraft}>
          Adicionar
        </Button>
      </div>
      {products.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {products.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-mono-nums"
            >
              {id}
              <button
                type="button"
                onClick={() => setProducts((prev) => prev.filter((p) => p !== id))}
                className="text-muted-foreground hover:text-danger"
                aria-label={`Remover produto ${id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Cadastre todos os produtos dessa oferta (order bumps, upsells, etc.) para o gráfico
          de vendas por produto reconhecer cada um.
        </p>
      )}
      <input type="hidden" name="hotmart_product_ids" value={products.join(",")} />
    </div>
  );
}

function SecretField({
  label,
  name,
  masked,
}: {
  label: string;
  name: string;
  masked?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="password"
        autoComplete="off"
        placeholder={masked ?? "Cole o token aqui"}
      />
      <p className="text-xs text-muted-foreground">
        {masked ? "Salvo — deixe em branco para manter." : "Nenhum token salvo ainda."}
      </p>
    </div>
  );
}
