-- Agrega cada visitante com seu lead mais recente, status de venda
-- (prioriza reembolso/chargeback > aprovada > outros) e contagem de
-- eventos — alimenta a tabela pesquisável do CRM (Sprint 6) sem o
-- servidor precisar cruzar visitors/leads/sales/events linha a linha.

create or replace view visitor_summary
with (security_invoker = true) as
with lead_info as (
  select distinct on (visitor_id) visitor_id, name, email, phone
  from leads
  where visitor_id is not null
  order by visitor_id, created_at desc
),
sale_info as (
  select distinct on (visitor_id) visitor_id, status, gross_value, approved_at
  from sales
  where visitor_id is not null
  order by
    visitor_id,
    case status
      when 'refunded' then 0
      when 'chargeback' then 0
      when 'approved' then 1
      else 2
    end,
    created_at desc
),
event_counts as (
  select visitor_id, count(*) as event_count, max(created_at) as last_event_at
  from events
  group by visitor_id
)
select
  v.id as visitor_id,
  v.offer_id,
  v.first_seen_at,
  v.last_seen_at,
  v.utm_source,
  v.utm_medium,
  v.utm_campaign,
  v.city,
  v.region,
  v.country,
  l.name as lead_name,
  l.email as lead_email,
  l.phone as lead_phone,
  s.status as sale_status,
  s.gross_value as sale_value,
  coalesce(e.event_count, 0) as event_count,
  e.last_event_at
from visitors v
left join lead_info l on l.visitor_id = v.id
left join sale_info s on s.visitor_id = v.id
left join event_counts e on e.visitor_id = v.id;

grant select on visitor_summary to authenticated;
