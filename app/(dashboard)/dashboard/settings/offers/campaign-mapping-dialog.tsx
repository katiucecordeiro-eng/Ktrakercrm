"use client";

import { useActionState } from "react";
import { Link2, Trash2 } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCampaignMapping,
  deleteCampaignMapping,
  type CampaignMappingActionState,
} from "./campaign-mapping-actions";

export type CampaignOption = { id: string; name: string };
export type CampaignMappingRow = {
  id: string;
  rawUtmCampaign: string;
  campaignId: string;
  campaignName: string | null;
};

function DeleteMappingButton({ id }: { id: string }) {
  const [, formAction, isPending] = useActionState<CampaignMappingActionState, FormData>(
    () => deleteCampaignMapping(id),
    undefined,
  );
  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" size="sm" disabled={isPending} aria-label="Remover mapeamento">
        <Trash2 className="size-3.5 text-muted-foreground hover:text-danger" />
      </Button>
    </form>
  );
}

export function CampaignMappingDialog({
  offerId,
  campaignOptions,
  mappings,
}: {
  offerId: string;
  campaignOptions: CampaignOption[];
  mappings: CampaignMappingRow[];
}) {
  const action = createCampaignMapping;
  const [state, formAction, isPending] = useActionState<CampaignMappingActionState, FormData>(
    action,
    undefined,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 /> Mapear UTMs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mapeamento manual de campanhas</DialogTitle>
          <DialogDescription>
            Quando um anúncio ativo não usa a convenção{" "}
            <code className="font-mono-nums">{"{{campaign.id}}--{{campaign.name}}"}</code>, o
            sistema tenta casar a venda por nome automaticamente. Se não bater, cadastre aqui o
            utm_campaign bruto que veio na venda apontando pra campanha real — a aba Campanhas
            passa a usar isso na próxima consulta.
          </DialogDescription>
        </DialogHeader>

        {mappings.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono-nums text-xs text-muted-foreground">
                    {mapping.rawUtmCampaign}
                  </p>
                  <p className="truncate text-foreground">→ {mapping.campaignName || mapping.campaignId}</p>
                </div>
                <DeleteMappingButton id={mapping.id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum mapeamento manual cadastrado ainda.</p>
        )}

        <form action={formAction} className="flex flex-col gap-4 border-t border-border pt-4">
          <input type="hidden" name="offer_id" value={offerId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`raw_utm_campaign_${offerId}`}>utm_campaign bruto (como veio na venda)</Label>
            <Input
              id={`raw_utm_campaign_${offerId}`}
              name="raw_utm_campaign"
              placeholder="ex.: Campanha Black Friday"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`campaign_id_${offerId}`}>Campanha real</Label>
            {campaignOptions.length > 0 ? (
              <Select name="campaign_id">
                <SelectTrigger id={`campaign_id_${offerId}`}>
                  <SelectValue placeholder="Selecione a campanha sincronizada" />
                </SelectTrigger>
                <SelectContent>
                  {campaignOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma campanha sincronizada ainda — sincronize o gasto da Meta primeiro.
              </p>
            )}
          </div>
          {state?.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          {state?.success ? <p className="text-sm text-accent">Mapeamento salvo.</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || campaignOptions.length === 0}>
              {isPending ? "Salvando..." : "Adicionar mapeamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
