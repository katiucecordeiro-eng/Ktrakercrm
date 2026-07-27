"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Granularity } from "@/lib/reports/types";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "weekday", label: "Dia da semana" },
];

export function RevenueGranularityToggle({ current }: { current: Granularity }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setGranularity(value: Granularity) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("chart_granularity", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-border p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant="ghost"
          className={
            current === option.value ? "bg-primary/15 text-accent" : "text-muted-foreground"
          }
          onClick={() => setGranularity(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
