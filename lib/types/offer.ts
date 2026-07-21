export type Offer = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  meta_pixel_id: string | null;
  meta_capi_token_ref: string | null;
  meta_ad_account_id: string | null;
  ga4_measurement_id: string | null;
  ga4_api_secret_ref: string | null;
  hotmart_product_ids: string[];
  currency: string;
  tax_rate: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};
