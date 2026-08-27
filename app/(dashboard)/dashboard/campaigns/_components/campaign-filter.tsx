"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CampaignOption = { id: string; name: string };

// Filtra a tabela por uma campanha específica e revela o funil de
// conversão só dela (ver CampaignFunnelSection) — as opções são as
// próprias campanhas já carregadas na página (sem query nova).
export function CampaignFilter({
  campaignId,
  options,
}: {
  campaignId: string | null;
  options: CampaignOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setCampaign(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("campaign");
    } else {
      params.set("campaign", value);
    }
    router.push(`?${params.toString()}`);
  }

  if (options.length === 0) return null;

  return (
    <Select value={campaignId ?? "all"} onValueChange={setCampaign}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Todas as campanhas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as campanhas</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
