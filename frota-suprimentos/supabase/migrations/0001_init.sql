-- Ecossistema Frota x Suprimentos
-- Elimina cadastro duplicado de itens "quase iguais" no ERP Benner:
-- a unidade nunca cadastra item direto, ela solicita; o Suprimentos
-- valida contra o catálogo padrão (vincula a um item existente ou
-- aprova como item novo, já cadastrado no Benner por eles) e mantém
-- aqui uma tabela-espelho do catálogo padronizado.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- =========================================================================
-- Perfis de acesso (papel + unidade), 1:1 com auth.users
-- =========================================================================

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  role text not null default 'unidade' check (role in ('unidade', 'suprimentos', 'frota_corporativo')),
  -- Só relevante para role = 'unidade': qual CDD/unidade esse usuário
  -- representa. Suprimentos e Frota Corporativo enxergam todas as unidades,
  -- por isso fica nulo para esses dois papéis.
  unidade text,
  created_at timestamptz not null default now()
);

comment on table profiles is
  'Papel de acesso por usuário. Cadastro de usuário é feito no Supabase Auth; '
  'o trigger abaixo cria a linha em profiles com role padrão "unidade" e '
  'unidade=NULL — quem sobe de nível (suprimentos/frota_corporativo) ou '
  'ganha uma unidade precisa ser ajustado manualmente (SQL/admin), não há '
  'tela de administração de usuários neste módulo ainda.';

-- Cria o profile automaticamente quando um usuário é criado no Supabase Auth.
-- SECURITY DEFINER para poder escrever em profiles apesar da RLS (o usuário
-- recém-criado ainda não tem sessão/JWT nesse momento).
create or replace function handle_new_user_frota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, nome, role, unidade)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', new.email), 'unidade', null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_frota on auth.users;
create trigger on_auth_user_created_frota
  after insert on auth.users
  for each row execute function handle_new_user_frota();

-- Funções auxiliares para as policies de RLS abaixo. SECURITY DEFINER pois
-- fazem SELECT em profiles, que também tem RLS — sem isso, checar o papel
-- do usuário dentro de uma policy de outra tabela cairia em recursão/negação.
create or replace function current_role_frota()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_unidade_frota()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select unidade from profiles where id = auth.uid();
$$;

alter table profiles enable row level security;

-- Leitura liberada para qualquer usuário autenticado: é necessária para
-- exibir nome de solicitante/responsável em joins nas telas de Suprimentos
-- e Frota Corporativo. Nenhuma policy de insert/update por aqui — a linha
-- é criada só pelo trigger (SECURITY DEFINER) e ajustes de role/unidade são
-- administrativos (service role), não uma ação do próprio usuário.
create policy "profiles: leitura autenticada"
  on profiles for select
  to authenticated
  using (true);

-- =========================================================================
-- Famílias/categorias de item (lookup para o select do formulário)
-- =========================================================================

create table if not exists familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  ordem int not null default 0
);

alter table familias enable row level security;

create policy "familias: leitura autenticada"
  on familias for select
  to authenticated
  using (true);

insert into familias (nome, ordem) values
  ('Freios', 10),
  ('Suspensão', 20),
  ('Motor', 30),
  ('Transmissão', 40),
  ('Arrefecimento', 50),
  ('Elétrica', 60),
  ('Pneus e Rodas', 70),
  ('Carroceria', 80),
  ('Hidráulico', 90),
  ('Filtros', 100),
  ('Lubrificantes e Fluidos', 110),
  ('Outros', 999)
on conflict (nome) do nothing;

-- =========================================================================
-- Normalização de referência do fabricante (tolerante a variação de
-- digitação: espaços, pontuação e caixa não devem impedir o match).
-- Marcada IMMUTABLE para poder ser usada em coluna gerada + indexada.
-- Limitação conhecida: não remove acentos (unaccent() não é IMMUTABLE por
-- depender da dictionary de busca textual) — na prática, referência de
-- fabricante quase sempre é alfanumérica, então o impacto é baixo.
-- =========================================================================

create or replace function normalize_reference(input text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(input, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- =========================================================================
-- Catálogo padrão (tabela-espelho do que já foi cadastrado no Benner)
-- =========================================================================

create table if not exists catalogo_padrao (
  id uuid primary key default gen_random_uuid(),
  codigo_benner text not null unique,
  nome_padronizado text not null,
  familia_id uuid references familias (id),
  -- Referência do fabricante usada como chave principal de busca por
  -- similaridade. Quando o item nasce de uma aprovação, é herdada da
  -- solicitação de origem; itens carregados por importação em massa (fora
  -- do escopo deste módulo ainda) podem deixar em branco.
  referencia_fabricante_principal text,
  referencia_normalizada text generated always as (normalize_reference(referencia_fabricante_principal)) stored,
  atributos_json jsonb not null default '{}'::jsonb,
  ncm_cest text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  data_ultima_revisao timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_catalogo_padrao_ref_norm on catalogo_padrao (referencia_normalizada);
create index if not exists idx_catalogo_padrao_nome_trgm on catalogo_padrao using gin (nome_padronizado gin_trgm_ops);
create index if not exists idx_catalogo_padrao_familia on catalogo_padrao (familia_id);

alter table catalogo_padrao enable row level security;

-- Leitura liberada a qualquer autenticado: a unidade também precisa
-- consultar o catálogo padrão na "busca de item existente" antes de abrir
-- uma solicitação nova.
create policy "catalogo_padrao: leitura autenticada"
  on catalogo_padrao for select
  to authenticated
  using (true);

create policy "catalogo_padrao: escrita só suprimentos"
  on catalogo_padrao for insert
  to authenticated
  with check (current_role_frota() = 'suprimentos');

create policy "catalogo_padrao: atualização só suprimentos"
  on catalogo_padrao for update
  to authenticated
  using (current_role_frota() = 'suprimentos')
  with check (current_role_frota() = 'suprimentos');

-- =========================================================================
-- Solicitações (fluxo unidade -> suprimentos)
-- =========================================================================

create table if not exists solicitacoes (
  id uuid primary key default gen_random_uuid(),
  unidade text not null,
  solicitante_id uuid not null references profiles (id),
  familia_id uuid not null references familias (id),
  descricao_curta text not null,
  referencia_fabricante text not null,
  referencia_normalizada text generated always as (normalize_reference(referencia_fabricante)) stored,
  aplicacao text not null,
  lado text check (lado is null or lado in ('D', 'E')),
  unidade_medida text not null,
  foto_url text,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_analise', 'vinculado', 'aprovado', 'rejeitado')),
  item_vinculado_id uuid references catalogo_padrao (id),
  responsavel_suprimentos_id uuid references profiles (id),
  data_solicitacao timestamptz not null default now(),
  data_resposta timestamptz,
  -- Prazo-alvo de resposta do Suprimentos. Heurística de 48h corridas a
  -- partir da abertura, ajustável — não vem de nenhum SLA contratual
  -- documentado; é o valor default em set_solicitacao_defaults() abaixo.
  sla_limite timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_solicitacoes_status_sla on solicitacoes (status, sla_limite);
create index if not exists idx_solicitacoes_unidade on solicitacoes (unidade);
create index if not exists idx_solicitacoes_ref_norm on solicitacoes (referencia_normalizada);
create index if not exists idx_solicitacoes_solicitante on solicitacoes (solicitante_id);

create or replace function set_solicitacao_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.sla_limite is null then
    new.sla_limite := coalesce(new.data_solicitacao, now()) + interval '48 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitacoes_defaults on solicitacoes;
create trigger trg_solicitacoes_defaults
  before insert on solicitacoes
  for each row execute function set_solicitacao_defaults();

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_solicitacoes_updated_at on solicitacoes;
create trigger trg_solicitacoes_updated_at
  before update on solicitacoes
  for each row execute function set_updated_at();

alter table solicitacoes enable row level security;

-- Unidade só vê/insere solicitações da própria unidade (comparada pelo
-- texto salvo em profiles.unidade do usuário logado, não pelo
-- solicitante_id sozinho — várias pessoas da mesma unidade compartilham a
-- fila de "Minhas Solicitações" do CDD).
create policy "solicitacoes: unidade vê a própria unidade"
  on solicitacoes for select
  to authenticated
  using (
    current_role_frota() in ('suprimentos', 'frota_corporativo')
    or (current_role_frota() = 'unidade' and unidade = current_unidade_frota())
  );

create policy "solicitacoes: unidade insere para a própria unidade"
  on solicitacoes for insert
  to authenticated
  with check (
    current_role_frota() = 'unidade'
    and unidade = current_unidade_frota()
    and solicitante_id = auth.uid()
  );

-- Só Suprimentos processa a fila (vincular/aprovar/rejeitar). A unidade não
-- edita a solicitação depois de enviada nesta versão do módulo.
create policy "solicitacoes: suprimentos atualiza"
  on solicitacoes for update
  to authenticated
  using (current_role_frota() = 'suprimentos')
  with check (current_role_frota() = 'suprimentos');

-- =========================================================================
-- Log de decisões (auditoria de vínculo/aprovação/rejeição)
-- =========================================================================

create table if not exists log_decisoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes (id) on delete cascade,
  decisao text not null check (decisao in ('vinculado_existente', 'aprovado_novo', 'rejeitado')),
  motivo text,
  responsavel_id uuid not null references profiles (id),
  item_id uuid references catalogo_padrao (id),
  data timestamptz not null default now()
);

create index if not exists idx_log_decisoes_solicitacao on log_decisoes (solicitacao_id);

alter table log_decisoes enable row level security;

create policy "log_decisoes: leitura suprimentos e frota corporativo"
  on log_decisoes for select
  to authenticated
  using (current_role_frota() in ('suprimentos', 'frota_corporativo'));

create policy "log_decisoes: insert só suprimentos"
  on log_decisoes for insert
  to authenticated
  with check (current_role_frota() = 'suprimentos' and responsavel_id = auth.uid());

-- =========================================================================
-- Busca por similaridade no catálogo padrão
-- Chave principal: referência do fabricante normalizada (match exato).
-- Fallback: similaridade textual (pg_trgm) na descrição/nome padronizado.
-- SECURITY INVOKER: roda com a policy de select do chamador (liberada a
-- todo autenticado em catalogo_padrao, então funciona igual para os 3 papéis).
-- =========================================================================

create or replace function buscar_itens_similares(
  p_referencia text,
  p_descricao text default '',
  p_familia_id uuid default null,
  p_limit int default 10
)
returns table (
  id uuid,
  codigo_benner text,
  nome_padronizado text,
  familia_id uuid,
  ncm_cest text,
  status text,
  match_tipo text,
  score real
)
language sql
stable
security invoker
as $$
  with ref as (
    select normalize_reference(p_referencia) as ref_norm
  )
  select
    c.id,
    c.codigo_benner,
    c.nome_padronizado,
    c.familia_id,
    c.ncm_cest,
    c.status,
    case
      when ref.ref_norm <> '' and c.referencia_normalizada = ref.ref_norm then 'referencia_exata'
      else 'similaridade_textual'
    end as match_tipo,
    greatest(
      similarity(c.nome_padronizado, coalesce(p_descricao, '')),
      case when ref.ref_norm <> '' and c.referencia_normalizada = ref.ref_norm then 1.0 else 0 end
    ) as score
  from catalogo_padrao c
  cross join ref
  where c.status = 'ativo'
    and (
      (ref.ref_norm <> '' and c.referencia_normalizada = ref.ref_norm)
      or similarity(c.nome_padronizado, coalesce(p_descricao, '')) > 0.2
    )
    and (p_familia_id is null or c.familia_id = p_familia_id)
  order by (ref.ref_norm <> '' and c.referencia_normalizada = ref.ref_norm) desc, score desc
  limit p_limit;
$$;

-- =========================================================================
-- Storage: fotos anexadas à solicitação (upload é feito pelo Painel da
-- Unidade, próxima etapa deste módulo — o bucket/policies já ficam
-- prontos aqui porque fazem parte do modelo de dados).
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('solicitacoes-fotos', 'solicitacoes-fotos', false)
on conflict (id) do nothing;

create policy "solicitacoes-fotos: upload autenticado"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'solicitacoes-fotos');

create policy "solicitacoes-fotos: leitura autenticada"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'solicitacoes-fotos');
