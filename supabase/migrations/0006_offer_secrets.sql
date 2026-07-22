-- Tokens colados diretamente no formulário de ofertas (em vez de referência
-- a nome de env var), guardados criptografados (AES-256-GCM, ver
-- lib/crypto/secrets.ts). A chave de criptografia fica só na env var
-- SECRETS_ENCRYPTION_KEY — nunca no banco.
alter table offers
  add column if not exists meta_capi_token text,
  add column if not exists meta_ads_token text,
  add column if not exists ga4_api_secret text;
