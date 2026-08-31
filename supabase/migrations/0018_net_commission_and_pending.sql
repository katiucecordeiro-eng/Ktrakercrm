-- Pedido da usuária, comparando com a Utmify: "Faturamento líquido" deve
-- refletir só a comissão dela (sem a taxa da Hotmart), não bruto − reembolso
-- como estava. Estende `daily_metrics` com net_commission/refunded_net_commission
-- (soma de sales.net_value, populado a partir de data.commissions com
-- source=PRODUCER) e uma agregação separada de vendas pendentes
-- (pending_value/pending_count) — pra nunca contarem como aprovada no
-- faturamento, e terem seu próprio card no dashboard.
--
-- Colunas novas vão no FINAL do select, preservando exatamente a ordem/
-- nome das colunas já existentes (incluindo initiated_count/meta_checkouts
-- da migration 0008) — o Postgres não deixa "create or replace view" mudar
-- posição/nome de colunas já existentes, só acrescentar no fim.
create or replace view daily_metrics
with (security_invoker = true) as
with approved_days as (
  select
    offer_id,
    (approved_at at time zone 'UTC')::date as date,
    sum(gross_value) as gross_revenue,
    -- coalesce pro caso de net_value ainda não ter sido capturado (venda
    -- anterior a esse campo existir, ou payload sem commissions) — cai pro
    -- valor bruto em vez de subtrair a venda inteira do total.
    sum(coalesce(net_value, gross_value)) as net_commission,
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
    sum(coalesce(net_value, gross_value)) as refunded_net_commission,
    count(*) as refunded_count
  from sales
  where status in ('refunded', 'chargeback') and refunded_at is not null
  group by offer_id, (refunded_at at time zone 'UTC')::date
),
pending_days as (
  select
    offer_id,
    (created_at at time zone 'UTC')::date as date,
    sum(gross_value) as pending_value,
    count(*) as pending_count
  from sales
  where status = 'pending'
  group by offer_id, (created_at at time zone 'UTC')::date
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
