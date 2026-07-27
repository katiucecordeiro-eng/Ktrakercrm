-- Duas correções no funil de conversão:
-- 1. "Checkouts iniciados" passa a vir da própria Meta (evento
--    InitiateCheckout do pixel, via Insights `actions`) em vez de só do
--    clique no link de checkout rastreado pelo track.js — o clique
--    rastreado sub-contava bastante (menos checkouts do que compras
--    aprovadas, o que é logicamente impossível).
-- 2. Nova contagem de "vendas iniciadas" (qualquer status, por
--    created_at) para diferenciar de "vendas aprovadas" — hoje só
--    existia o segundo.
alter table ad_spend add column if not exists meta_initiate_checkout bigint;

create or replace view daily_metrics
with (security_invoker = true) as
with approved_days as (
  select
    offer_id,
    (approved_at at time zone 'UTC')::date as date,
    sum(gross_value) as gross_revenue,
    count(*) as sales_count
  from sales
  where status = 'approved' and approved_at is not null
  group by offer_id, (approved_at at time zone 'UTC')::date
),
refunded_days as (
  select
    offer_id,
    (refunded_at at time zone 'UTC')::date as date,
    sum(gross_value) as refunded_value,
    count(*) as refunded_count
  from sales
  where status in ('refunded', 'chargeback') and refunded_at is not null
  group by offer_id, (refunded_at at time zone 'UTC')::date
),
initiated_days as (
  select
    offer_id,
    (created_at at time zone 'UTC')::date as date,
    count(*) as initiated_count
  from sales
  group by offer_id, (created_at at time zone 'UTC')::date
),
spend_days as (
  select
    offer_id, date,
    sum(spend) as ad_spend,
    sum(clicks) as clicks,
    sum(impressions) as impressions,
    sum(meta_initiate_checkout) as meta_checkouts
  from ad_spend
  group by offer_id, date
),
all_days as (
  select offer_id, date from approved_days
  union
  select offer_id, date from refunded_days
  union
  select offer_id, date from initiated_days
  union
  select offer_id, date from spend_days
)
select
  d.offer_id,
  d.date,
  coalesce(a.gross_revenue, 0) as gross_revenue,
  coalesce(a.sales_count, 0) as sales_count,
  coalesce(r.refunded_value, 0) as refunded_value,
  coalesce(r.refunded_count, 0) as refunded_count,
  coalesce(sp.ad_spend, 0) as ad_spend,
  coalesce(sp.clicks, 0) as clicks,
  coalesce(sp.impressions, 0) as impressions,
  coalesce(i.initiated_count, 0) as initiated_count,
  coalesce(sp.meta_checkouts, 0) as meta_checkouts
from all_days d
left join approved_days a on a.offer_id = d.offer_id and a.date = d.date
left join refunded_days r on r.offer_id = d.offer_id and r.date = d.date
left join initiated_days i on i.offer_id = d.offer_id and i.date = d.date
left join spend_days sp on sp.offer_id = d.offer_id and sp.date = d.date;

grant select on daily_metrics to authenticated;
