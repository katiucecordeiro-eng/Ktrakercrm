import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { parseReportFilters, type RawSearchParams } from "@/lib/reports/filters";
import {
  getCampaignTable,
  getFunnel,
  getHourlyBreakdown,
  getKpis,
  getPaymentBreakdown,
  getRegionRanking,
  getSalesByProduct,
  getTimeSeries,
} from "@/lib/reports/queries";
import type { Offer } from "@/lib/types/offer";

import { PeriodSwitcher } from "./_components/period-switcher";
import { KpiCards } from "./_components/kpi-cards";
import { FunnelChart } from "./_components/funnel-chart";
import { RevenueChart } from "./_components/revenue-chart";
import { CampaignTable } from "./_components/campaign-table";
import { PaymentDonut } from "./_components/payment-donut";
import { ProductSalesChart } from "./_components/product-sales-chart";
import { HourlyChart } from "./_components/hourly-chart";
import { RegionRanking } from "./_components/region-ranking";
import { LiveEventLog } from "./_components/live-event-log";

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

export default async function DashboardOverviewPage({
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
  const offerNames = Object.fromEntries(offers.map((o) => [o.id, o.name]));

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">
            Configure o Supabase para ver KPIs, funil e gráficos com dados reais.
            Enquanto isso, cadastre suas ofertas em Configurações.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [kpis, funnel, timeSeries, campaigns, payments, hourly, regions, products] = await Promise.all([
    getKpis(supabase, filters, offers),
    getFunnel(supabase, filters),
    getTimeSeries(supabase, filters),
    getCampaignTable(supabase, filters),
    getPaymentBreakdown(supabase, filters),
    getHourlyBreakdown(supabase, filters),
    getRegionRanking(supabase, filters),
    getSalesByProduct(supabase, filters),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">
            {selectedOffer ? selectedOffer.name : "Todas as ofertas"}
          </p>
        </div>
        <Suspense fallback={<div className="h-9 w-[180px]" />}>
          <PeriodSwitcher
            period={filters.period}
            since={filters.since.toISOString().slice(0, 10)}
            until={filters.until.toISOString().slice(0, 10)}
          />
        </Suspense>
      </div>

      <KpiCards kpis={kpis} currency={currency} />
      <FunnelChart steps={funnel} />
      <RevenueChart data={timeSeries} currency={currency} />
      <CampaignTable rows={campaigns} currency={currency} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductSalesChart rows={products} currency={currency} />
        <PaymentDonut rows={payments} currency={currency} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HourlyChart rows={hourly} />
        <RegionRanking rows={regions} />
      </div>

      <LiveEventLog offerId={filters.offerId} offerNames={offerNames} supabaseConfigured={configured} />
    </div>
  );
}
