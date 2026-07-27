"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";

type SaleRow = {
  id: string;
  offer_id: string;
  status: string;
  gross_value: number | null;
  currency: string;
  product_name: string | null;
};

export function NewSaleToastListener({ offerNames }: { offerNames: Record<string, string> }) {
  const { toast } = useToast();

  useEffect(() => {
    const supabase = createClient();

    function notifyApprovedSale(sale: SaleRow) {
      toast({
        title: "Nova venda aprovada! 🎉",
        description: `${offerNames[sale.offer_id] ?? "Oferta"} — ${sale.product_name ?? "produto"} — ${formatCurrency(sale.gross_value ?? 0, sale.currency)}`,
        variant: "success",
      });
    }

    const channel = supabase
      .channel("sales-toast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales" },
        (payload) => {
          const row = payload.new as SaleRow;
          if (row.status === "approved") notifyApprovedSale(row);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sales" },
        (payload) => {
          const row = payload.new as SaleRow;
          const previous = payload.old as Partial<SaleRow>;
          if (row.status === "approved" && previous.status !== "approved") notifyApprovedSale(row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- offerNames muda de identidade a cada render do layout, mas o conteúdo é estável na prática
  }, []);

  return null;
}
