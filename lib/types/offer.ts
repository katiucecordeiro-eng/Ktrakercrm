export type Offer = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  meta_pixel_id: string | null;
  meta_capi_token_ref: string | null;
  /** Token CAPI colado no formulário, criptografado (AES-256-GCM). */
  meta_capi_token: string | null;
  /** Código do Meta Test Events (não é segredo — a própria Meta exibe na tela de Test Events). */
  meta_test_event_code: string | null;
  meta_ad_account_id: string | null;
  /** Token da Marketing API colado no formulário, criptografado. */
  meta_ads_token: string | null;
  ga4_measurement_id: string | null;
  ga4_api_secret_ref: string | null;
  /** GA4 API secret colado no formulário, criptografado. */
  ga4_api_secret: string | null;
  /** ID da conta comercial do Instagram (não é secreto). */
  instagram_business_account_id: string | null;
  /** Token do Instagram Graph API colado no formulário, criptografado. */
  instagram_access_token: string | null;
  hotmart_product_ids: string[];
  currency: string;
  tax_rate: number;
  /** Meta de ROAS usada nos badges verde/vermelho (não vem de benchmark). */
  roas_target: number;
  /** Fuso horário usado na quebra de vendas por hora do dia (IANA, ex. America/Sao_Paulo). */
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};
