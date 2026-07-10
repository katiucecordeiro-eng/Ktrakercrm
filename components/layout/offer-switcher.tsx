"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Offer } from "@/lib/types/offer";

export function OfferSwitcher({ offers }: { offers: Offer[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("offer") ?? "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("offer");
    } else {
      params.set("offer", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Todas as ofertas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as ofertas</SelectItem>
        {offers.map((offer) => (
          <SelectItem key={offer.id} value={offer.slug}>
            {offer.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
