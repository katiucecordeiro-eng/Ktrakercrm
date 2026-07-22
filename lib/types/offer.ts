export type Offer = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  meta_pixel_id: string | null;
  meta_capi_token_ref: string | null;
  /** Token CAPI colado no formulário, criptografado (AES-256-GCM). */
  meta_capi_token: string | null;
  meta_ad_account_id: string | null;
  /** Token da Marketing API colado no formulário, criptografado. */
  meta_ads_token: string | null;
  ga4_measurement_id: string | null;
  ga4_api_secret_ref: string | null;
  /** GA4 API secret colado no formulário, criptografado. */
  ga4_api_secret: string | null;
  hotmart_product_ids: string[];
  currency: string;
  tax_rate: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};
