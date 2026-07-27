"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CampaignStatusFilter({ status }: { status: "ativo" | "pausado" | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("campaign_status");
    } else {
      params.set("campaign_status", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={status ?? "all"} onValueChange={setStatus}>
      <SelectTrigger className="w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os status</SelectItem>
        <SelectItem value="ativo">Ativas</SelectItem>
        <SelectItem value="pausado">Pausadas</SelectItem>
      </SelectContent>
    </Select>
  );
}
