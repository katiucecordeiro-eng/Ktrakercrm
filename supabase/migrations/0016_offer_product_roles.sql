-- Papel de cada produto Hotmart dentro do funil da oferta (produto
-- principal, order bump, upsell, downsell) — pedido da usuária pra
-- calcular taxa de order bump/upsell, igual a uma visão que ela viu em
-- outro painel. Tabela separada de `offers.hotmart_product_ids` (que
-- continua sendo a fonte usada pelo webhook pra resolver a oferta a
-- partir de product.id) pra não arriscar quebrar esse fluxo já em
-- produção — aqui é só metadado adicional por produto já cadastrado.
create table if not exists offer_product_roles (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  hotmart_product_id text not null,
  role text not null check (role in ('principal', 'order_bump', 'upsell', 'downsell')),
  created_at timestamptz not null default now(),
  unique (offer_id, hotmart_product_id)
);

create index if not exists offer_product_roles_offer_id_idx on offer_product_roles (offer_id);

alter table offer_product_roles enable row level security;

create policy "authenticated full access" on offer_product_roles
  for all to authenticated using (true) with check (true);
