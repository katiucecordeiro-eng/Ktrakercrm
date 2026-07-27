import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { parseReportFilters, type RawSearchParams } from "@/lib/reports/filters";
import { getCreativeInsights } from "@/lib/reports/creative-insights";
import { getLeadMaturity } from "@/lib/reports/lead-maturity";
import { fetchInstagramPosts } from "@/lib/instagram/api-client";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { Offer } from "@/lib/types/offer";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { PeriodSwitcher } from "../_components/period-switcher";
import { CreativePerformanceTable } from "./_components/creative-performance-table";
import { InstagramPostsSection } from "./_components/instagram-posts-section";
import { LeadMaturitySection } from "./_components/lead-maturity-section";

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

export default async function MetaIntelligencePage({
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

  if (!configured) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Meta Business Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Configure o Supabase para ver criativos, posts e maturidade de leads com dados reais.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const leadMaturityPromise = getLeadMaturity(supabase, filters.offerId);

  // Criativos (thumbnail) e Instagram exigem uma oferta específica (uma
  // conta de anúncio / conta comercial por vez) — "todas as ofertas" só
  // funciona pra seção 3 (maturidade do lead), que agrega visitantes.
  const creativeInsightsPromise = selectedOffer
    ? getCreativeInsights(supabase, filters, selectedOffer)
    : Promise.resolve([]);

  const instagramConfigured = Boolean(
    selectedOffer?.instagram_business_account_id && selectedOffer?.instagram_access_token,
  );
  const instagramPromise =
    instagramConfigured && selectedOffer
      ? fetchInstagramPosts({
          businessAccountId: selectedOffer.instagram_business_account_id!,
          accessToken: decryptSecret(selectedOffer.instagram_access_token) ?? "",
        })
      : Promise.resolve({ posts: [], error: undefined as string | undefined });

  const [creativeInsights, instagramResult, leadMaturity] = await Promise.all([
    creativeInsightsPromise,
    instagramPromise,
    leadMaturityPromise,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Meta Business Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            {selectedOffer ? selectedOffer.name : "Todas as ofertas"} — criativos, posts orgânicos e
            maturidade do lead.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-[180px]" />}>
          <PeriodSwitcher
            period={filters.period}
            since={filters.since.toISOString().slice(0, 10)}
            until={filters.until.toISOString().slice(0, 10)}
          />
        </Suspense>
      </div>

      {selectedOffer ? (
        <CreativePerformanceTable insights={creativeInsights} currency={currency} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Performance de criativos pagos</CardTitle>
            <CardDescription>
              Selecione uma oferta específica no topo (não é possível ver criativos de &quot;todas as
              ofertas&quot; ao mesmo tempo — cada uma usa sua própria conta de anúncio).
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}

      {selectedOffer ? (
        <InstagramPostsSection configured={instagramConfigured} posts={instagramResult.posts} error={instagramResult.error} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Análise de posts orgânicos (Instagram)</CardTitle>
            <CardDescription>Selecione uma oferta específica para ver os posts dessa conta.</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}

      <LeadMaturitySection result={leadMaturity} />
    </div>
  );
}
