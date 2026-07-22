import { decryptSecret } from "@/lib/crypto/secrets";
import { postWithRetry, type SendResult } from "@/lib/utils/fetch-retry";
import type { Offer } from "@/lib/types/offer";

// GA4 exige nomes de evento alfanuméricos + underscore, começando com letra.
function sanitizeEventName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `evt_${cleaned}`;
}

type SendGa4EventParams = {
  offer: Offer;
  eventName: string;
  clientId: string;
  params?: Record<string, unknown>;
};

export async function sendGa4Event(
  params: SendGa4EventParams,
): Promise<SendResult | { status: "skipped"; response: unknown }> {
  const { offer } = params;

  if (!offer.ga4_measurement_id) {
    return { status: "skipped", response: { reason: "Oferta sem GA4 Measurement ID configurado" } };
  }

  const secret = decryptSecret(offer.ga4_api_secret);
  if (!secret) {
    return {
      status: "skipped",
      response: { reason: "GA4 API secret não configurado para esta oferta" },
    };
  }

  const body = {
    client_id: params.clientId,
    events: [
      {
        name: sanitizeEventName(params.eventName),
        params: params.params ?? {},
      },
    ],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(offer.ga4_measurement_id)}&api_secret=${encodeURIComponent(secret)}`;

  return postWithRetry(url, body);
}
