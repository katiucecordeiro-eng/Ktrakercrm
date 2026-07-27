import { Plus, Pencil } from "lucide-react";

// As Server Actions de sincronização desta página (vendas retroativas
// Hotmart, gasto Meta) fazem chamadas paginadas que podem passar dos 10s
// que a Vercel dá por padrão no plano Hobby — Server Actions herdam o
// maxDuration da rota que as invoca, não o próprio arquivo da action.
export const maxDuration = 60;

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { maskSecret } from "@/lib/crypto/secrets";
import type { Offer } from "@/lib/types/offer";
import { OfferFormDialog } from "./offer-form-dialog";
import { InstallSnippetDialog } from "./install-snippet-dialog";
import { UtmTemplateDialog } from "./utm-template-dialog";
import { SyncAdSpendDialog } from "./sync-ad-spend-dialog";
import { AccountSpendDialog } from "./account-spend-dialog";
import { HotmartSyncDialog } from "./hotmart-sync-dialog";
import { ConnectionTestDialog } from "./connection-test-dialog";
import { RecentWebhooks } from "./recent-webhooks";
import { CampaignMappingDialog, type CampaignOption, type CampaignMappingRow } from "./campaign-mapping-dialog";

async function getOffers(): Promise<Offer[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("offers")
      .select("*")
      .order("created_at", { ascending: true });
    return (data as Offer[]) ?? [];
  } catch {
    return [];
  }
}

// Campanhas reais distintas (sincronizadas da Meta) por oferta — usadas
// como opções no mapeamento manual de UTM (Sprint D). Sem filtro de data:
// qualquer campanha já sincronizada alguma vez serve como alvo do mapeamento.
async function getCampaignOptionsByOffer(): Promise<Map<string, CampaignOption[]>> {
  const byOffer = new Map<string, CampaignOption[]>();
  if (!isSupabaseConfigured()) return byOffer;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ad_spend")
      .select("offer_id, campaign_id, campaign_name")
      .order("campaign_name", { ascending: true });
    const seen = new Set<string>();
    for (const row of (data as { offer_id: string; campaign_id: string; campaign_name: string | null }[] | null) ?? []) {
      const key = `${row.offer_id}::${row.campaign_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const list = byOffer.get(row.offer_id) ?? [];
      list.push({ id: row.campaign_id, name: row.campaign_name || row.campaign_id });
      byOffer.set(row.offer_id, list);
    }
    return byOffer;
  } catch {
    return byOffer;
  }
}

async function getMappingsByOffer(
  campaignOptionsByOffer: Map<string, CampaignOption[]>,
): Promise<Map<string, CampaignMappingRow[]>> {
  const byOffer = new Map<string, CampaignMappingRow[]>();
  if (!isSupabaseConfigured()) return byOffer;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("campaign_utm_mappings")
      .select("id, offer_id, raw_utm_campaign, campaign_id, campaign_name")
      .order("created_at", { ascending: false });
    for (const row of (data as
      | { id: string; offer_id: string; raw_utm_campaign: string; campaign_id: string; campaign_name: string | null }[]
      | null) ?? []) {
      const list = byOffer.get(row.offer_id) ?? [];
      const knownName = campaignOptionsByOffer
        .get(row.offer_id)
        ?.find((option) => option.id === row.campaign_id)?.name;
      list.push({
        id: row.id,
        rawUtmCampaign: row.raw_utm_campaign,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name || knownName || null,
      });
      byOffer.set(row.offer_id, list);
    }
    return byOffer;
  } catch {
    return byOffer;
  }
}

export default async function OffersPage() {
  const offers = await getOffers();
  const campaignOptionsByOffer = await getCampaignOptionsByOffer();
  const mappingsByOffer = await getMappingsByOffer(campaignOptionsByOffer);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Ofertas</h1>
          <p className="text-sm text-muted-foreground">
            Cada oferta representa uma página/produto rastreado — domínio,
            Pixel Meta, GA4 e produtos Hotmart próprios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UtmTemplateDialog />
          <OfferFormDialog
            trigger={
              <Button>
                <Plus /> Nova oferta
              </Button>
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ofertas cadastradas</CardTitle>
          <CardDescription>
            {offers.length === 0
              ? "Nenhuma oferta cadastrada ainda."
              : `${offers.length} oferta(s) cadastrada(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Domínio</TableHead>
                  <TableHead>Pixel Meta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => {
                  const { meta_capi_token, meta_ads_token, ga4_api_secret, instagram_access_token, ...safeOffer } =
                    offer;
                  const maskedSecrets = {
                    metaCapiToken: maskSecret(meta_capi_token),
                    metaAdsToken: maskSecret(meta_ads_token),
                    ga4ApiSecret: maskSecret(ga4_api_secret),
                    instagramAccessToken: maskSecret(instagram_access_token),
                  };
                  return (
                    <TableRow key={offer.id}>
                      <TableCell className="font-medium">{offer.name}</TableCell>
                      <TableCell className="font-mono-nums text-muted-foreground">
                        {offer.slug}
                      </TableCell>
                      <TableCell>{offer.domain || "—"}</TableCell>
                      <TableCell className="font-mono-nums">
                        {offer.meta_pixel_id || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={offer.active ? "default" : "secondary"}>
                          {offer.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex justify-end gap-2 text-right">
                        <InstallSnippetDialog slug={offer.slug} />
                        <SyncAdSpendDialog offerId={offer.id} />
                        <AccountSpendDialog offerId={offer.id} />
                        <HotmartSyncDialog offerId={offer.id} />
                        <ConnectionTestDialog offerId={offer.id} slug={offer.slug} />
                        <CampaignMappingDialog
                          offerId={offer.id}
                          campaignOptions={campaignOptionsByOffer.get(offer.id) ?? []}
                          mappings={mappingsByOffer.get(offer.id) ?? []}
                        />
                        <OfferFormDialog
                          offer={safeOffer}
                          maskedSecrets={maskedSecrets}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Pencil /> Editar
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cadastre sua primeira oferta para liberar o snippet de instalação
              do <code className="font-mono-nums">track.js</code>.
            </p>
          )}
        </CardContent>
      </Card>

      <RecentWebhooks />
    </div>
  );
}
