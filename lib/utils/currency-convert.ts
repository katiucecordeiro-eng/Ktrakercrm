export type CurrencyConversion = {
  valueBRL: number;
  rate: number;
};

// Moeda igual a BRL (com variações de caixa) não precisa de conversão —
// evita uma chamada de rede à toa no caminho comum (público majoritariamente
// brasileiro).
export function needsConversion(currency: string | null | undefined): currency is string {
  return !!currency && currency.trim().toUpperCase() !== "BRL";
}

// AwesomeAPI (economia.awesomeapi.com.br) — cotação pública brasileira,
// sem chave de API, com endpoint pronto pra "moeda-BRL". Usada só pro caso
// raro de comprador estrangeiro pagando em outra moeda; se a chamada
// falhar (rede fora do ar, moeda não suportada), devolve null e quem
// chamou decide o fallback — nunca inventa uma taxa aproximada, pra não
// gravar um valor de venda errado silenciosamente.
export async function convertToBRL(
  value: number,
  fromCurrency: string,
  attempt = 0,
): Promise<CurrencyConversion | null> {
  const currency = fromCurrency.trim().toUpperCase();
  if (currency === "BRL") return { valueBRL: value, rate: 1 };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${currency}-BRL`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as Record<string, { bid?: string }>;
    const rateRaw = json[`${currency}BRL`]?.bid;
    const rate = rateRaw ? Number(rateRaw) : NaN;

    if (!rate || Number.isNaN(rate) || rate <= 0) {
      throw new Error(`Cotação inválida para ${currency}-BRL: ${JSON.stringify(json)}`);
    }

    return { valueBRL: value * rate, rate };
  } catch (error) {
    if (attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return convertToBRL(value, currency, attempt + 1);
    }
    console.error("[currency-convert] falha ao converter pra BRL", {
      currency,
      value,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
