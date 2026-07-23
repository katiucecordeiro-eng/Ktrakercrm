"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { refreshDashboardDataAction } from "../refresh-actions";

export function RefreshButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => { await refreshDashboardDataAction(); })}
    >
      <RefreshCw className={isPending ? "animate-spin" : ""} />
      {isPending ? "Atualizando..." : "Atualizar"}
    </Button>
  );
}
