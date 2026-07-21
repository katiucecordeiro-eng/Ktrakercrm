"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type MobileSidebarState = { open: boolean; setOpen: (value: boolean) => void };

const MobileSidebarContext = createContext<MobileSidebarState | null>(null);

export function MobileSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>{children}</MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  const context = useContext(MobileSidebarContext);
  if (!context) {
    throw new Error("useMobileSidebar deve ser usado dentro de MobileSidebarProvider");
  }
  return context;
}
