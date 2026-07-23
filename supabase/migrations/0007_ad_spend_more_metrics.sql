-- Métricas adicionais da Meta Insights API (além de spend/impressions/clicks
-- já existentes): alcance e frequência, pedidas para a tabela de
-- campanhas/criativos do dashboard.
alter table ad_spend add column if not exists reach bigint;
alter table ad_spend add column if not exists frequency numeric(10, 4);

-- Recria a view incluindo os novos campos (reach/frequency são somados por
-- dia como aproximação — a Meta não deduplica alcance entre dias somados,
-- então "alcance" no período é uma soma, não o alcance único real).
create or replace view campaign_performance
with (security_invoker = true) as
with spend as (
  select offer_id, date, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
    spend, clicks, impressions, reach, frequency
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
  coalesce(sp.reach, 0) as reach,
  sp.frequency as frequency,
  coalesce(sb.revenue, 0) as revenue,
  coalesce(sb.sales_count, 0) as sales_count
from keys k
left join spend sp
  on sp.offer_id = k.offer_id and sp.date = k.date and sp.campaign_id = k.campaign_id
  and sp.adset_id = k.adset_id and sp.ad_id = k.ad_id
left join sales_by_ad sb
  on sb.offer_id = k.offer_id and sb.date = k.date and sb.campaign_id = k.campaign_id
  and sb.adset_id = k.adset_id and sb.ad_id = k.ad_id;

grant select on campaign_performance to authenticated;
