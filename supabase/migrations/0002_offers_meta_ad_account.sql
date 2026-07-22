-- Conta de anúncio Meta por oferta, usada pelo cron de sincronização de
-- gasto (Sprint 4) para saber de qual ad account puxar os Insights.
alter table offers
  add column if not exists meta_ad_account_id text;
