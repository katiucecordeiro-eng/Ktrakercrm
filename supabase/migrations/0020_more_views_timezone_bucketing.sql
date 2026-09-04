-- Mesma causa raiz da migration 0019, nas outras duas views que também
-- bucketizam por dia em UTC em vez do fuso da oferta: `funnel_by_offer`
-- (usada por getFunnel/getKpis pra checkouts iniciados/pageviews) e
-- `campaign_performance` (usada por getCampaignTable, tabela de campanhas
-- da Visão Geral). Sem esse fix, o funil e a tabela de campanhas da Visão
-- Geral continuariam contando venda/evento de "ontem à noite (BRT)" como
-- se fosse "hoje", mesmo depois da correção da 0019 em `daily_metrics`.
create or replace view funnel_by_offer
with (security_invoker = true) as
select
  e.offer_id,
  (e.created_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date as date,
  count(*) filter (where e.event_name = 'PageView') as pageviews,
  count(*) filter (where e.event_name = 'ViewContent') as view_content,
  count(*) filter (where e.event_name = 'AddToCart') as add_to_cart,
  count(*) filter (where e.event_name = 'InitiateCheckout') as initiate_checkout
from events e
join offers o on o.id = e.offer_id
group by e.offer_id, (e.created_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date;

grant select on funnel_by_offer to authenticated;

create or replace view campaign_performance
with (security_invoker = true) as
with spend as (
  select
    offer_id, date, campaign_id, campaign_name, adset_id, adset_name,
    ad_id, ad_name, spend, clicks, impressions, reach, frequency
  from ad_spend
),
sales_by_ad as (
  select
    s.offer_id,
    (s.approved_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date as date,
    s.campaign_id, s.adset_id, s.ad_id,
    sum(s.gross_value) filter (where s.status = 'approved') as revenue,
    count(*) filter (where s.status = 'approved') as sales_count
  from sales s
  join offers o on o.id = s.offer_id
  where s.ad_id is not null and s.approved_at is not null
  group by s.offer_id, (s.approved_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date, s.campaign_id, s.adset_id, s.ad_id
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
  sp.frequency,
  coalesce(sb.revenue, 0) as revenue,
  coalesce(sb.sales_count, 0) as sales_count
from keys k
left join spend sp on sp.offer_id = k.offer_id and sp.date = k.date and sp.campaign_id = k.campaign_id and sp.adset_id = k.adset_id and sp.ad_id = k.ad_id
left join sales_by_ad sb on sb.offer_id = k.offer_id and sb.date = k.date and sb.campaign_id = k.campaign_id and sb.adset_id = k.adset_id and sb.ad_id = k.ad_id;

grant select on campaign_performance to authenticated;
