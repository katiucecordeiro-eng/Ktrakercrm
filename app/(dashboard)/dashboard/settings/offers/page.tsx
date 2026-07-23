import { Plus, Pencil } from "lucide-react";

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
import { SyncAdSpendDialog } from "./sync-ad-spend-dialog";
import { AccountSpendDialog } from "./account-spend-dialog";
import { HotmartSyncDialog } from "./hotmart-sync-dialog";
import { ConnectionTestDialog } from "./connection-test-dialog";
import { RecentWebhooks } from "./recent-webhooks";

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

export default async function OffersPage() {
  const offers = await getOffers();

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
        <OfferFormDialog
          trigger={
            <Button>
              <Plus /> Nova oferta
            </Button>
          }
        />
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
                  const { meta_capi_token, meta_ads_token, ga4_api_secret, ...safeOffer } = offer;
                  const maskedSecrets = {
                    metaCapiToken: maskSecret(meta_capi_token),
                    metaAdsToken: maskSecret(meta_ads_token),
                    ga4ApiSecret: maskSecret(ga4_api_secret),
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
                        <ConnectionTestDialog offerId={offer.id} />
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
