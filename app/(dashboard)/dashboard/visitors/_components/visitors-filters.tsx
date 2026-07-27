"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VisitorStatus } from "@/lib/crm/types";

const STATUS_LABELS: Record<VisitorStatus, string> = {
  visitor: "Visitante",
  lead: "Lead",
  buyer: "Comprador",
  refunded: "Reembolsado",
};

export function VisitorsFilters({
  status,
  since,
  until,
}: {
  status: VisitorStatus | null;
  since: string | null;
  until: string | null;
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
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={status ?? "all"}
          onValueChange={(value) => setParam("status", value === "all" ? null : value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABELS) as VisitorStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {STATUS_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Desde</Label>
        <Input
          type="date"
          defaultValue={since ?? ""}
          onChange={(e) => setParam("since", e.target.value || null)}
          className="w-[150px]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Até</Label>
        <Input
          type="date"
          defaultValue={until ?? ""}
          onChange={(e) => setParam("until", e.target.value || null)}
          className="w-[150px]"
        />
      </div>
    </div>
  );
}
