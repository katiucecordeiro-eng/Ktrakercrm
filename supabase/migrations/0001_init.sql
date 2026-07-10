-- KTracker CRM — schema inicial (multi-oferta)
-- Tracking server-side + CRM + dashboard: offers, visitors, events, leads, sales, ad_spend, webhook_logs

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================
-- offers — entidade central. Tudo no sistema é escopado por offer_id.
-- =========================================================
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,
  meta_pixel_id text,
  meta_capi_token_ref text, -- nome da env var que guarda o token (o valor nunca fica no banco)
  ga4_measurement_id text,
  ga4_api_secret_ref text, -- nome da env var que guarda o api secret
  hotmart_product_ids text[] not null default '{}',
  currency text not null default 'BRL',
  tax_rate numeric(5, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger offers_set_updated_at
  before update on offers
  for each row execute function set_updated_at();

-- =========================================================
-- visitors — um registro por visitor_id (gerado pelo track.js)
-- =========================================================
create table if not exists visitors (
  id uuid primary key, -- visitor_id gerado no client (uuid v4)
  offer_id uuid not null references offers(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  fbp text,
  fbc text,
  ga_client_id text,
  referrer text,
  landing_page text,
  ip inet,
  user_agent text,
  city text,
  region text,
  country text,
  device_type text
);

create index if not exists visitors_offer_id_idx on visitors (offer_id);

-- =========================================================
-- events — cada evento de tracking (PageView, ViewContent, Purchase, ...)
-- =========================================================
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  offer_id uuid not null references offers(id) on delete cascade,
  event_name text not null,
  event_id uuid not null, -- usado para deduplicação client/server na Meta
  page_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  meta_status text not null default 'skipped' check (meta_status in ('sent', 'failed', 'skipped')),
  meta_response jsonb,
  ga4_status text not null default 'skipped' check (ga4_status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists events_offer_id_created_at_idx on events (offer_id, created_at desc);
create index if not exists events_visitor_id_idx on events (visitor_id);
create index if not exists events_event_id_idx on events (event_id);

-- =========================================================
-- leads — captura de formulário próprio e/ou abandono de carrinho Hotmart
-- =========================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid references visitors(id) on delete set null,
  offer_id uuid not null references offers(id) on delete cascade,
  name text,
  email text,
  phone text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists leads_offer_id_idx on leads (offer_id);
create index if not exists leads_email_idx on leads (email);

-- =========================================================
-- sales — vendas confirmadas via webhook Hotmart
-- =========================================================
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  visitor_id uuid references visitors(id) on delete set null,
  hotmart_transaction_id text not null unique,
  product_id text,
  product_name text,
  status text not null check (
    status in ('approved', 'pending', 'refunded', 'chargeback', 'canceled')
  ),
  payment_method text,
  installments int,
  gross_value numeric(12, 2),
  net_value numeric(12, 2),
  currency text not null default 'BRL',
  buyer_email_hash text,
  buyer_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_id text,
  adset_id text,
  ad_id text,
  approved_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  raw_payload jsonb
);

create index if not exists sales_offer_id_idx on sales (offer_id);
create index if not exists sales_visitor_id_idx on sales (visitor_id);
create index if not exists sales_status_idx on sales (status);
create index if not exists sales_ad_id_idx on sales (ad_id);

-- =========================================================
-- ad_spend — gasto sincronizado da Meta Marketing API
-- =========================================================
create table if not exists ad_spend (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  date date not null,
  campaign_id text not null,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text not null,
  ad_name text,
  spend numeric(12, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cpc numeric(12, 4),
  cpm numeric(12, 4),
  synced_at timestamptz not null default now(),
  unique (date, ad_id)
);

create index if not exists ad_spend_offer_id_date_idx on ad_spend (offer_id, date);

-- =========================================================
-- webhook_logs — auditoria de tudo que chega (Hotmart, Meta)
-- =========================================================
create table if not exists webhook_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('hotmart', 'meta')),
  payload jsonb,
  status text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists webhook_logs_source_created_at_idx on webhook_logs (source, created_at desc);

-- =========================================================
-- Row Level Security
-- Sistema single-user (dono da conta) por enquanto: qualquer usuário
-- autenticado no painel tem acesso total. Rotas de API (webhooks,
-- /api/track, cron) usam a service role key, que ignora RLS.
-- =========================================================
alter table offers enable row level security;
alter table visitors enable row level security;
alter table events enable row level security;
alter table leads enable row level security;
alter table sales enable row level security;
alter table ad_spend enable row level security;
alter table webhook_logs enable row level security;

create policy "authenticated full access" on offers
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on visitors
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on events
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on leads
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on sales
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on ad_spend
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on webhook_logs
  for all to authenticated using (true) with check (true);
