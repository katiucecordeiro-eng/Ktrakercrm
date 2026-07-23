// Extratores defensivos do payload da Hotmart. O formato exato de alguns
// campos (em especial os parâmetros de rastreamento sck/src) varia entre
// integrações e não pôde ser confirmado contra a documentação ao vivo
// neste ambiente — por isso cada extrator tenta múltiplos caminhos
// plausíveis, e o payload bruto sempre fica salvo em `webhook_logs` para
// ajuste fino caso a Hotmart use um caminho diferente do esperado.

type Json = Record<string, unknown>;

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Json)) {
      return (acc as Json)[key];
    }
    return undefined;
  }, obj);
}

function firstString(data: Json, paths: string[]): string | null {
  for (const path of paths) {
    const value = get(data, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function extractSck(data: Json): string | null {
  return firstString(data, [
    "purchase.tracking.source_sck",
    "purchase.origin.sck",
    "purchase.sck",
    "tracking.sck",
    "sck",
  ]);
}

export function extractSrc(data: Json): string | null {
  return firstString(data, [
    "purchase.tracking.source",
    "purchase.origin.src",
    "purchase.src",
    "tracking.src",
    "src",
  ]);
}

export function extractTransactionId(data: Json): string | null {
  return firstString(data, ["purchase.transaction", "purchase.order_id", "transaction"]);
}

export function extractProductId(data: Json): string | null {
  const id = get(data, "product.id");
  if (typeof id === "number") return String(id);
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

export function extractBuyer(data: Json) {
  return {
    email: firstString(data, ["buyer.email"]),
    name: firstString(data, ["buyer.name"]),
    phone: firstString(data, ["buyer.checkout_phone", "buyer.phone"]),
  };
}

// O evento de abandono de carrinho tem um payload mais simples que o de
// compra — os dados do lead às vezes vêm no topo, às vezes aninhados.
export function extractCartAbandonmentLead(data: Json) {
  return {
    email: firstString(data, ["email", "buyer.email"]),
    name: firstString(data, ["name", "buyer.name"]),
    phone: firstString(data, ["phone", "checkout_phone", "buyer.checkout_phone"]),
  };
}

export function extractPurchaseValue(data: Json) {
  const gross = get(data, "purchase.price.value") ?? get(data, "purchase.full_price.value");
  const currency =
    firstString(data, ["purchase.price.currency_value", "purchase.full_price.currency_value"]) ??
    "BRL";
  return {
    value: typeof gross === "number" ? gross : null,
    currency,
  };
}

export function extractPayment(data: Json) {
  return {
    method: firstString(data, ["purchase.payment.type", "purchase.payment.method"]),
    installments: (() => {
      const value = get(data, "purchase.payment.installments_number");
      return typeof value === "number" ? value : null;
    })(),
  };
}

// Convenção de UTM do projeto: "{{id}}--{{name}}" → devolve só o id.
export function extractIdFromUtm(value: string | null | undefined): string | null {
  if (!value) return null;
  const [id] = value.split("--");
  return id?.trim() || null;
}

export const PURCHASE_EVENT_STATUS: Record<string, string> = {
  PURCHASE_APPROVED: "approved",
  PURCHASE_COMPLETE: "approved",
  PURCHASE_REFUNDED: "refunded",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_CANCELED: "canceled",
  PURCHASE_BILLET_PRINTED: "pending",
  PURCHASE_DELAYED: "pending",
  PURCHASE_PROTEST: "chargeback",
};

// A API de Vendas (histórico) devolve o status em `purchase.status`, com
// valores diferentes dos nomes de evento do webhook — mapeamento também não
// validado contra uma resposta real; ajustar se algum status vier como
// "sem-mapeamento" nos itens importados.
export const SALES_HISTORY_STATUS: Record<string, string> = {
  APPROVED: "approved",
  COMPLETE: "approved",
  REFUNDED: "refunded",
  CHARGEBACK: "chargeback",
  CANCELLED: "canceled",
  CANCELED: "canceled",
  PRINTED_BILLET: "pending",
  BILLET_PRINTED: "pending",
  WAITING_PAYMENT: "pending",
  DELAYED: "pending",
  PROTESTED: "chargeback",
  EXPIRED: "canceled",
};

export function extractSalesHistoryStatus(data: Json): string | null {
  const raw = firstString(data, ["purchase.status"]);
  if (!raw) return null;
  return SALES_HISTORY_STATUS[raw.toUpperCase()] ?? null;
}

export function extractApprovedDate(data: Json): string | null {
  const value = get(data, "purchase.approved_date") ?? get(data, "purchase.order_date");
  if (typeof value === "number") return new Date(value).toISOString();
  return null;
}
