import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { parseReportFilters, type RawSearchParams } from "@/lib/reports/filters";
import {
  getCampaignFunnel,
  getCampaignsFullTable,
  getCampaignSummary,
  getRoasTimeSeries,
  getTopCreativesByRoas,
} from "@/lib/reports/campaigns";
import type { Offer } from "@/lib/types/offer";
import { Skeleton } from "@/components/ui/skeleton";

import { PeriodSwitcher } from "../_components/period-switcher";
import { FunnelChart } from "../_components/funnel-chart";
import { CampaignSummaryCards } from "./_components/campaign-summary-cards";
import { TopCreativesChart } from "./_components/top-creatives-chart";
import { RoasTrendChart } from "./_components/roas-trend-chart";
import { CampaignStatusFilter } from "./_components/campaign-status-filter";
import { CampaignFilter } from "./_components/campaign-filter";
import { CampaignsTableSection } from "./_components/campaigns-table-section";

async function getOffers(): Promise<Offer[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("offers").select("*").order("created_at", { ascending: true });
    return (data as Offer[]) ?? [];
  } catch {
    return [];
  }
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const configured = isSupabaseConfigured();
  const offers = await getOffers();
  const resolvedSearchParams = await searchParams;
  const filters = parseReportFilters(resolvedSearchParams, offers);
  const selectedOffer = offers.find((o) => o.id === filters.offerId) ?? null;
  const currency = selectedOffer?.currency ?? "BRL";

  const statusParam =
    typeof resolvedSearchParams.campaign_status === "string" ? resolvedSearchParams.campaign_status : null;
  const campaignStatus = statusParam === "ativo" || statusParam === "pausado" ? statusParam : null;
  const campaignIdParam = typeof resolvedSearchParams.campaign === "string" ? resolvedSearchParams.campaign : null;

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Configure o Supabase para ver campanhas, conjuntos e criativos com dados reais.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ rows: allRows }, roasTrend] = await Promise.all([
    getCampaignsFullTable(supabase, filters),
    getRoasTimeSeries(supabase, filters),
  ]);

  const campaignOptions = allRows
    .filter((row) => !row.unattributed)
    .map((row) => ({ id: row.id, name: row.name }));
  // Só trata como "selecionada" se a campanha ainda existir nesse recorte
  // (oferta/período) — evita passar um id obsoleto pro funil depois de
  // trocar de oferta ou período com uma campanha já selecionada.
  const selectedCampaign = campaignIdParam
    ? (allRows.find((row) => row.id === campaignIdParam && !row.unattributed) ?? null)
    : null;

  const rows = allRows.filter((row) => {
    if (selectedCampaign) return row.id === selectedCampaign.id;
    if (campaignStatus) return row.unattributed || row.status === campaignStatus;
    return true;
  });
  const summary = getCampaignSummary(allRows);
  const topCreatives = getTopCreativesByRoas(allRows, 5);
  const campaignFunnel = selectedCampaign
    ? await getCampaignFunnel(supabase, filters, selectedCampaign.id)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            {selectedOffer ? selectedOffer.name : "Todas as ofertas"} — drill-down até criativo, com
            atribuição de vendas por UTM (exata, mapeamento manual ou por nome).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={<Skeleton className="h-9 w-[220px]" />}>
            <CampaignFilter campaignId={selectedCampaign?.id ?? null} options={campaignOptions} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-9 w-[150px]" />}>
            <CampaignStatusFilter status={campaignStatus} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-9 w-[180px]" />}>
            <PeriodSwitcher
              period={filters.period}
              since={filters.since.toISOString().slice(0, 10)}
              until={filters.until.toISOString().slice(0, 10)}
            />
          </Suspense>
        </div>
      </div>

      <CampaignSummaryCards summary={summary} currency={currency} />

      {selectedCampaign && campaignFunnel ? (
        <FunnelChart
          steps={campaignFunnel}
          title={`Funil de conversão — ${selectedCampaign.name}`}
          description="Cliques → página → checkout iniciado → venda iniciada → venda aprovada, só desta campanha (mesma atribuição por UTM da tabela abaixo)."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopCreativesChart creatives={topCreatives} />
        <RoasTrendChart data={roasTrend} />
      </div>

      <CampaignsTableSection rows={rows} currency={currency} roasTarget={selectedOffer?.roas_target ?? 2} />
    </div>
  );
}
