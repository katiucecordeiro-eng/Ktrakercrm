-- Auditoria das ações de gerenciamento de campanha disparadas direto do
-- CRM (pausar/ativar campanha/conjunto/anúncio, editar orçamento) — a
-- Marketing API não devolve um histórico dessas mudanças, então sem isso
-- não haveria como saber depois "quando/quem pausou o quê" (mesmo sendo
-- um sistema single-user, vale registrar pra auditoria e pra debugar um
-- resultado inesperado na conta de anúncio).
create table if not exists campaign_action_logs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  level text not null check (level in ('campaign', 'adset', 'ad')),
  entity_id text not null,
  entity_name text,
  action text not null check (action in ('activate', 'pause', 'update_budget')),
  detail text,
  success boolean not null,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_action_logs_offer_id_idx on campaign_action_logs (offer_id);
create index if not exists campaign_action_logs_entity_id_idx on campaign_action_logs (entity_id);

alter table campaign_action_logs enable row level security;

create policy "authenticated full access" on campaign_action_logs
  for all to authenticated using (true) with check (true);
