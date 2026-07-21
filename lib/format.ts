export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value || 0);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value || 0));
}

export function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatRoas(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}x`;
}
