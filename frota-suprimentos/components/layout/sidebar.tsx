"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/layout/logout-button";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function Sidebar({
  painelLabel,
  userNome,
  userSubtitulo,
  items,
}: {
  painelLabel: string;
  userNome: string;
  userSubtitulo: string;
  items: SidebarNavItem[];
}) {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-bold tracking-tight text-foreground">
          Gestão em Movimento
        </span>
      </div>
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">
          {painelLabel}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const isActive = pathname?.startsWith(item.href) ?? false;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-l-2 border-accent bg-surface-hover text-foreground"
                  : "border-l-2 border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{userNome}</p>
          <p className="truncate text-xs text-muted-foreground">{userSubtitulo}</p>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
