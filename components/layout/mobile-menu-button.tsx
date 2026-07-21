"use client";

import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMobileSidebar } from "./mobile-sidebar-context";

export function MobileMenuButton() {
  const { setOpen } = useMobileSidebar();
  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
      <Menu className="size-5" />
      <span className="sr-only">Abrir menu</span>
    </Button>
  );
}
