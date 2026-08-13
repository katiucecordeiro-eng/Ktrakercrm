import { sha256, normalizePhone } from "@/lib/crypto/hash";
import { decryptSecret } from "@/lib/crypto/secrets";
import { postWithRetry, type SendResult } from "@/lib/utils/fetch-retry";
import type { Offer } from "@/lib/types/offer";

const META_API_VERSION = "v21.0";

export function metaTestEventCodeEnvName(slug: string) {
  return `META_TEST_EVENT_CODE_${slug.toUpperCase().replace(/-/g, "_")}`;
}

type SendMetaEventParams = {
  offer: Offer;
  eventName: string;
  eventId: string;
  eventTime: number;
  eventSourceUrl?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  externalId: string;
  email?: string | null;
  phone?: string | null;
  // Advanced Matching extra — melhora o Event Match Quality (EMQ) além de
  // email/telefone/external_id. Nem sempre disponíveis (depende do payload
  // de origem); só entram no user_data quando vierem preenchidos.
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  countryCode?: string | null;
  customData?: Record<string, unknown>;
};

// Normalização da Meta pra city/zip: minúsculo, sem espaços (fn/ln/st/
// country já ficam bons só com o trim+lowercase que sha256() já faz).
function hashNoSpaces(value: string): string {
  return sha256(value.replace(/\s+/g, ""));
}

export async function sendMetaEvent(
  params: SendMetaEventParams,
): Promise<(SendResult | { status: "skipped"; response: unknown }) & { request: unknown }> {
  const { offer } = params;

  if (!offer.meta_pixel_id) {
    return { status: "skipped", response: { reason: "Oferta sem Pixel ID configurado" }, request: null };
  }

  const token = decryptSecret(offer.meta_capi_token);
  if (!token) {
    return {
      status: "skipped",
      response: { reason: "Token CAPI não configurado para esta oferta" },
      request: null,
    };
  }

  const userData: Record<string, unknown> = {
    external_id: sha256(params.externalId),
  };
  if (params.clientIpAddress) userData.client_ip_address = params.clientIpAddress;
  if (params.clientUserAgent) userData.client_user_agent = params.clientUserAgent;
  if (params.fbp) userData.fbp = params.fbp;
  if (params.fbc) userData.fbc = params.fbc;
  if (params.email) userData.em = sha256(params.email);
  if (params.phone) userData.ph = sha256(normalizePhone(params.phone));
  if (params.firstName) userData.fn = sha256(params.firstName);
  if (params.lastName) userData.ln = sha256(params.lastName);
  if (params.city) userData.ct = hashNoSpaces(params.city);
  if (params.state) userData.st = sha256(params.state);
  if (params.zipCode) userData.zp = hashNoSpaces(params.zipCode);
  if (params.countryCode) userData.country = sha256(params.countryCode);

  const eventData = {
    event_name: params.eventName,
    event_id: params.eventId,
    event_time: params.eventTime,
    event_source_url: params.eventSourceUrl || undefined,
    action_source: "website",
    user_data: userData,
    custom_data: params.customData,
  };

  const body: Record<string, unknown> = {
    data: [eventData],
  };

  // Campo do formulário da oferta é a fonte principal (não exige redeploy
  // pra cadastrar uma oferta nova); env var por slug fica só como fallback
  // legado pra quem configurou antes desse campo existir.
  const testEventCode = offer.meta_test_event_code || process.env[metaTestEventCodeEnvName(offer.slug)];
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${offer.meta_pixel_id}/events?access_token=${encodeURIComponent(token)}`;

  // Guarda só o evento em si (user_data já vem hasheado) — nunca o
  // access_token, que fica só na URL da chamada.
  const result = await postWithRetry(url, body);
  return { ...result, request: eventData };
}
