-- Sprint E: token do Instagram Graph API (posts orgânicos), colado direto
-- no formulário da oferta e criptografado — mesmo esquema de
-- meta_capi_token/meta_ads_token/ga4_api_secret (ver lib/crypto/secrets.ts).
-- instagram_business_account_id é o ID da conta comercial do Instagram
-- vinculada à Página do Facebook (não é secreto, fica em texto puro como
-- meta_ad_account_id).
alter table offers
  add column if not exists instagram_access_token text,
  add column if not exists instagram_business_account_id text;
