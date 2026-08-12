"use client";

import { useActionState } from "react";
import { Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveProductRoles, type ProductRolesActionState } from "./product-roles-actions";

export type ProductRoleOption = {
  productId: string;
  productName: string | null;
  role: "principal" | "order_bump" | "upsell" | "downsell" | "";
};

export function ProductRolesDialog({
  offerId,
  products,
}: {
  offerId: string;
  products: ProductRoleOption[];
}) {
  const action = saveProductRoles.bind(null, offerId);
  const [state, formAction, isPending] = useActionState<ProductRolesActionState, FormData>(
    action,
    undefined,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layers /> Papéis dos produtos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Papéis dos produtos</DialogTitle>
          <DialogDescription>
            Marca cada produto Hotmart desta oferta como principal, order bump, upsell ou
            downsell — usado pra calcular a taxa de anexo na Visão Geral. Produtos sem venda
            ainda aparecem só pelo ID (sem nome conhecido); confira no seu catálogo Hotmart qual
            é qual.
          </DialogDescription>
        </DialogHeader>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre os produtos Hotmart desta oferta primeiro (campo &quot;Produtos Hotmart&quot; em
            Editar).
          </p>
        ) : (
          <form action={formAction} className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-3">
              {products.map((product) => (
                <div key={product.productId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {product.productName ?? "(sem venda ainda)"}
                    </p>
                    <p className="truncate font-mono-nums text-xs text-muted-foreground">
                      {product.productId}
                    </p>
                  </div>
                  <input type="hidden" name="product_id" value={product.productId} />
                  <Select name="role" defaultValue={product.role || "none"}>
                    <SelectTrigger className="w-[160px] shrink-0">
                      <SelectValue placeholder="Sem papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem papel</SelectItem>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="order_bump">Order bump</SelectItem>
                      <SelectItem value="upsell">Upsell</SelectItem>
                      <SelectItem value="downsell">Downsell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {state?.error ? (
              <p className="text-sm text-danger" role="alert">
                {state.error}
              </p>
            ) : null}
            {state?.success ? <p className="text-sm text-accent">{state.success}</p> : null}

            <p className="text-xs text-muted-foreground">
              Só o produto principal entra no denominador da taxa de anexo.
            </p>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
