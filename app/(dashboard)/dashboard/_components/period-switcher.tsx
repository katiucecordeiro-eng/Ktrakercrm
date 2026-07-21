"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_LABELS, PERIOD_OPTIONS } from "@/lib/reports/filters";
import type { PeriodPreset } from "@/lib/reports/types";

export function PeriodSwitcher({
  period,
  since,
  until,
}: {
  period: PeriodPreset;
  since: string;
  until: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={period} onValueChange={(value) => setParam("period", value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {PERIOD_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === "custom" ? (
        <>
          <Input
            type="date"
            defaultValue={since}
            onChange={(e) => setParam("since", e.target.value)}
            className="w-[150px]"
          />
          <Input
            type="date"
            defaultValue={until}
            onChange={(e) => setParam("until", e.target.value)}
            className="w-[150px]"
          />
        </>
      ) : null}
    </div>
  );
}
