-- Sprint D: mapeamento manual de UTM → campanha real, pra quando o
-- anúncio ativo não segue a convenção {{campaign.id}}--{{campaign.name}}
-- e o fallback automático (match por nome) não é suficiente/confiável.
create table if not exists campaign_utm_mappings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  raw_utm_campaign text not null,
  campaign_id text not null,
  campaign_name text,
  created_at timestamptz not null default now(),
  unique (offer_id, raw_utm_campaign)
);

create index if not exists campaign_utm_mappings_offer_id_idx on campaign_utm_mappings (offer_id);

alter table campaign_utm_mappings enable row level security;

create policy "authenticated full access" on campaign_utm_mappings
  for all to authenticated using (true) with check (true);
