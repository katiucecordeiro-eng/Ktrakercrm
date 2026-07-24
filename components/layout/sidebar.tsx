"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, LogOut, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth/actions";
import { useMobileSidebar } from "./mobile-sidebar-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/dashboard/visitors", label: "CRM / Visitantes", icon: Users },
  { href: "/dashboard/settings/offers", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useMobileSidebar();

  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="text-base font-semibold tracking-tight">
            KTracker <span className="text-accent">CRM</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground md:hidden"
          >
            <X className="size-5" />
            <span className="sr-only">Fechar menu</span>
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "border-accent bg-primary/15 text-accent"
                    : "border-transparent text-muted-foreground hover:border-accent/40 hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="size-4 transition-transform group-hover:translate-x-0.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="border-t border-border p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-danger"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </form>
      </aside>
    </>
  );
}
