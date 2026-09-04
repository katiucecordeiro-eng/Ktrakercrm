-- Bug real reportado pela usuária: "hoje" mostrava vendas que a própria
-- Hotmart/Utmify não confirmavam, e "ontem" ficava faltando vendas reais.
-- Causa raiz: todas as CTEs de `daily_metrics` agrupavam por dia usando
-- `at time zone 'UTC'`, mas o resto do app (lib/reports/filters.ts,
-- lib/utils/timezone.ts) já calcula os limites de "hoje"/"ontem" no fuso
-- da oferta (America/Sao_Paulo por padrão). Uma venda aprovada às 21:24
-- (horário de Brasília) de um dia vira 00:24 UTC do dia seguinte — a view
-- jogava essa venda pro dia seguinte (UTC), enquanto o filtro de período
-- pedia o dia anterior (BRT): a venda desaparecia de "ontem" e "aparecia"
-- em "hoje" sem nunca ter sido aprovada hoje de fato.
--
-- Corrigido bucketing por `at time zone o.timezone` (join com `offers`,
-- fallback 'America/Sao_Paulo' se a oferta não tiver fuso configurado —
-- mesmo default usado em parseReportFilters). ad_spend.date não muda:
-- já vem como data pronta da Meta Insights, sem timestamp pra converter.
--
-- Colunas/ordem inalteradas (mesma restrição de "create or replace view"
-- das migrations 0008/0018) — só a expressão de agrupamento por dia muda.
create or replace view daily_metrics
with (security_invoker = true) as
with approved_days as (
  select
    s.offer_id,
    (s.approved_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date as date,
    sum(s.gross_value) as gross_revenue,
    sum(coalesce(s.net_value, s.gross_value)) as net_commission,
    count(*) as sales_count
  from sales s
  join offers o on o.id = s.offer_id
  where s.status = 'approved' and s.approved_at is not null
  group by s.offer_id, (s.approved_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date
),
refunded_days as (
  select
    s.offer_id,
    (s.refunded_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date as date,
    sum(s.gross_value) as refunded_value,
    sum(coalesce(s.net_value, s.gross_value)) as refunded_net_commission,
    count(*) as refunded_count
  from sales s
  join offers o on o.id = s.offer_id
  where s.status in ('refunded', 'chargeback') and s.refunded_at is not null
  group by s.offer_id, (s.refunded_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date
),
pending_days as (
  select
    s.offer_id,
    (s.created_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date as date,
    sum(s.gross_value) as pending_value,
    count(*) as pending_count
  from sales s
  join offers o on o.id = s.offer_id
  where s.status = 'pending'
  group by s.offer_id, (s.created_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date
),
initiated_days as (
  select
    s.offer_id,
    (s.created_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date as date,
    count(*) as initiated_count
  from sales s
  join offers o on o.id = s.offer_id
  group by s.offer_id, (s.created_at at time zone coalesce(o.timezone, 'America/Sao_Paulo'))::date
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
  select offer_id, date from pending_days
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
  coalesce(sp.meta_checkouts, 0) as meta_checkouts,
  coalesce(a.net_commission, 0) as net_commission,
  coalesce(r.refunded_net_commission, 0) as refunded_net_commission,
  coalesce(p.pending_value, 0) as pending_value,
  coalesce(p.pending_count, 0) as pending_count
from all_days d
left join approved_days a on a.offer_id = d.offer_id and a.date = d.date
left join refunded_days r on r.offer_id = d.offer_id and r.date = d.date
left join pending_days p on p.offer_id = d.offer_id and p.date = d.date
left join initiated_days i on i.offer_id = d.offer_id and i.date = d.date
left join spend_days sp on sp.offer_id = d.offer_id and sp.date = d.date;

grant select on daily_metrics to authenticated;
