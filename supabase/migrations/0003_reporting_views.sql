-- Views de relatório — pré-agregam por dia para o dashboard nunca
-- precisar somar linha a linha de `sales`/`events`/`ad_spend` no
-- servidor Next.js; a granularidade maior (semana/mês) é feita reagrupando
-- essas linhas diárias já pequenas. `security_invoker` garante que a RLS
-- das tabelas de origem continua valendo para quem consulta a view.

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
spend_days as (
  select offer_id, date, sum(spend) as ad_spend, sum(clicks) as clicks, sum(impressions) as impressions
  from ad_spend
  group by offer_id, date
),
all_days as (
  select offer_id, date from approved_days
  union
  select offer_id, date from refunded_days
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
  coalesce(sp.impressions, 0) as impressions
from all_days d
left join approved_days a on a.offer_id = d.offer_id and a.date = d.date
left join refunded_days r on r.offer_id = d.offer_id and r.date = d.date
left join spend_days sp on sp.offer_id = d.offer_id and sp.date = d.date;

create or replace view funnel_by_offer
with (security_invoker = true) as
select
  offer_id,
  (created_at at time zone 'UTC')::date as date,
  count(*) filter (where event_name = 'PageView') as pageviews,
  count(*) filter (where event_name = 'ViewContent') as view_content,
  count(*) filter (where event_name = 'AddToCart') as add_to_cart,
  count(*) filter (where event_name = 'InitiateCheckout') as initiate_checkout
from events
group by offer_id, (created_at at time zone 'UTC')::date;

create or replace view campaign_performance
with (security_invoker = true) as
with spend as (
  select offer_id, date, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
    spend, clicks, impressions
  from ad_spend
),
sales_by_ad as (
  select
    offer_id,
    (approved_at at time zone 'UTC')::date as date,
    campaign_id, adset_id, ad_id,
    sum(gross_value) filter (where status = 'approved') as revenue,
    count(*) filter (where status = 'approved') as sales_count
  from sales
  where ad_id is not null and approved_at is not null
  group by offer_id, (approved_at at time zone 'UTC')::date, campaign_id, adset_id, ad_id
),
keys as (
  select offer_id, date, campaign_id, adset_id, ad_id from spend
  union
  select offer_id, date, campaign_id, adset_id, ad_id from sales_by_ad
)
select
  k.offer_id,
  k.date,
  k.campaign_id,
  coalesce(sp.campaign_name, '') as campaign_name,
  k.adset_id,
  coalesce(sp.adset_name, '') as adset_name,
  k.ad_id,
  coalesce(sp.ad_name, '') as ad_name,
  coalesce(sp.spend, 0) as spend,
  coalesce(sp.clicks, 0) as clicks,
  coalesce(sp.impressions, 0) as impressions,
  coalesce(sb.revenue, 0) as revenue,
  coalesce(sb.sales_count, 0) as sales_count
from keys k
left join spend sp
  on sp.offer_id = k.offer_id and sp.date = k.date and sp.campaign_id = k.campaign_id
  and sp.adset_id = k.adset_id and sp.ad_id = k.ad_id
left join sales_by_ad sb
  on sb.offer_id = k.offer_id and sb.date = k.date and sb.campaign_id = k.campaign_id
  and sb.adset_id = k.adset_id and sb.ad_id = k.ad_id;

grant select on daily_metrics to authenticated;
grant select on funnel_by_offer to authenticated;
grant select on campaign_performance to authenticated;
