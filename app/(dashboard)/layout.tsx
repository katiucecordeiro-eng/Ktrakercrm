import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";

import { Sidebar } from "@/components/layout/sidebar";
import { OfferSwitcher } from "@/components/layout/offer-switcher";
import { LiveIndicator } from "@/components/layout/live-indicator";
import { MobileSidebarProvider } from "@/components/layout/mobile-sidebar-context";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Offer } from "@/lib/types/offer";

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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const offers = await getOffers();
  const configured = isSupabaseConfigured();

  return (
    <MobileSidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <MobileMenuButton />
              <Suspense fallback={<div className="h-9 w-[180px]" />}>
                <OfferSwitcher offers={offers} />
              </Suspense>
            </div>
            <LiveIndicator connected={configured} />
          </header>
          {!configured ? (
            <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning md:px-6">
              <AlertTriangle className="size-4 shrink-0" />
              Supabase não configurado — defina as variáveis de ambiente para
              ativar login, ofertas e dados reais (veja .env.example).
            </div>
          ) : null}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
