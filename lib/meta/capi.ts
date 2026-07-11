import { sha256, normalizePhone } from "@/lib/crypto/hash";
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
  customData?: Record<string, unknown>;
};

export async function sendMetaEvent(
  params: SendMetaEventParams,
): Promise<SendResult | { status: "skipped"; response: unknown }> {
  const { offer } = params;

  if (!offer.meta_pixel_id || !offer.meta_capi_token_ref) {
    return { status: "skipped", response: { reason: "Oferta sem Pixel ID ou token CAPI configurado" } };
  }

  const token = process.env[offer.meta_capi_token_ref];
  if (!token) {
    return {
      status: "skipped",
      response: { reason: `Env var ${offer.meta_capi_token_ref} não definida` },
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

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: params.eventName,
        event_id: params.eventId,
        event_time: params.eventTime,
        event_source_url: params.eventSourceUrl || undefined,
        action_source: "website",
        user_data: userData,
        custom_data: params.customData,
      },
    ],
  };

  const testEventCode = process.env[metaTestEventCodeEnvName(offer.slug)];
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${offer.meta_pixel_id}/events?access_token=${encodeURIComponent(token)}`;

  return postWithRetry(url, body);
}
