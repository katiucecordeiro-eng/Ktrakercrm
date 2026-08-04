import { ListChecks } from "lucide-react";

import { Sidebar } from "@/components/layout/sidebar";
import { requireRole } from "@/lib/auth/profile";

const NAV_ITEMS = [{ href: "/fila", label: "Fila de Solicitações", icon: ListChecks }];

export default async function SuprimentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("suprimentos");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        painelLabel="Painel Suprimentos"
        userNome={profile.nome}
        userSubtitulo="Suprimentos"
        items={NAV_ITEMS}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
