# Ecossistema Frota x Suprimentos

Módulo do Hub "Gestão em Movimento" que elimina cadastro duplicado de itens
"quase iguais" no ERP Benner: a unidade nunca cadastra item direto — ela
solicita, e o Suprimentos valida e cadastra no padrão.

Projeto Next.js **separado** dos outros painéis do Hub (não existia um Hub
"Gestão em Movimento" nem os painéis "Farol Frota"/"Planner Corporativo" no
repositório no momento em que este módulo foi criado — ver decisão registrada
na sessão que iniciou este módulo). Segue a mesma paleta descrita no pedido
original (navy `#0a0e1a`, laranja `#ff6b1a`) e a mesma arquitetura de
referência já validada no projeto irmão `../` (KTracker CRM): Next.js App
Router + TypeScript + Tailwind v4 + Supabase (`@supabase/ssr`) + componentes
`components/ui/` escritos à mão no padrão shadcn/ui + Server Actions com Zod.

## Estado atual

Implementado nesta rodada (modelo de dados + Painel do Suprimentos):

- **Schema completo** (`supabase/migrations/0001_init.sql`): `profiles`
  (papel + unidade), `familias` (lookup, seed com 12 categorias), `solicitacoes`,
  `catalogo_padrao`, `log_decisoes`, função `buscar_itens_similares` (match
  exato por referência normalizada + fallback por similaridade textual via
  `pg_trgm`), RLS por papel, bucket de Storage para fotos.
- **Login + guarda de papel** (`app/login/`, `lib/auth/profile.ts`): 3 papéis
  (`unidade`, `suprimentos`, `frota_corporativo`), cada um só acessa seu
  painel — redirect automático pela home de cada papel.
- **Painel do Suprimentos** (`app/(suprimentos)/`):
  - `/fila`: fila de pendentes ordenada por SLA mais urgente primeiro.
  - `/solicitacoes/[id]`: ao abrir, transiciona `pendente` → `em_analise`
    automaticamente; roda a busca por similaridade; permite **Vincular a
    item existente** (encerra sem criar item novo), **Aprovar como item
    novo** (formulário com nome padronizado sugerido por template, código
    Benner, NCM/CEST, unidade de medida — grava na tabela-espelho
    `catalogo_padrao`) ou **Rejeitar** (não estava no pedido original, mas
    o enum de status já previa `rejeitado` — sem essa ação a fila teria
    solicitações inválidas presas para sempre).

## Ainda não implementado (próximas etapas, por ordem do pedido original)

1. **Painel da Unidade** (`unidade`): busca de item existente antes de
   solicitar, formulário de "Solicitação de Item Novo" (a maioria dos campos
   já existe no schema, incluindo upload de foto — o bucket já está criado),
   lista "Minhas Solicitações".
2. **Painel Frota Corporativo** (`frota_corporativo`, rota `/governanca`):
   KPIs (abertas x fechadas, SLA médio, % duplicidade evitada, ranking de
   unidades), no estilo dos cards grandes + listas categorizadas do Hub.
3. Criação de usuários/atribuição de papel e unidade ainda é manual via SQL
   (`profiles.role`/`profiles.unidade`) — não há tela de administração.

## Rodando localmente

```bash
cd frota-suprimentos
npm install
cp .env.example .env.local   # preencher com um projeto Supabase
npm run dev                  # http://localhost:3001 (ajuste a porta se preciso)
```

Rode a migration em `supabase/migrations/0001_init.sql` no projeto Supabase
(pode ser o mesmo projeto do Hub, se as tabelas não colidirem com outro
módulo, ou um projeto dedicado). Depois de criar o primeiro usuário via
Supabase Auth, ele nasce com `role = 'unidade'` e `unidade = NULL`
(trigger `handle_new_user_frota`) — promova manualmente via SQL, ex.:

```sql
update profiles set role = 'suprimentos' where id = '<uuid do usuário>';
```

## Decisões e limitações assumidas

- **Código Benner não é gerado pelo sistema.** O fluxo real é: Suprimentos
  cadastra o item no Benner (fora deste app) e cola o código resultante no
  formulário de aprovação — `catalogo_padrao` é uma tabela-espelho, não a
  fonte da verdade do Benner.
- **Normalização de referência não remove acentos** (só minúsculas +
  caracteres não alfanuméricos) — `unaccent()` do Postgres não é `IMMUTABLE`
  por padrão, então não pode compor a coluna gerada `referencia_normalizada`
  sem um wrapper de confiabilidade não testada. Na prática, referência de
  fabricante costuma ser alfanumérica, então o impacto é baixo; documentar
  aqui para revisar se aparecer um caso real de referência acentuada.
- **SLA de 48h é heurística fixa** (`set_solicitacao_defaults()` na
  migration), sem SLA contratual documentado por trás — ajustável.
- **Transição para "Em Análise" acontece ao abrir a solicitação pela
  primeira vez** (não há um botão explícito "Iniciar análise") — decisão de
  UX para não adicionar um clique extra antes da busca por similaridade, que
  já roda automaticamente.
- **RLS de leitura de `profiles` e `catalogo_padrao` é aberta a qualquer
  autenticado** (não só ao próprio papel) — necessário para exibir nomes em
  joins e para a futura busca de item existente no Painel da Unidade. Sem
  dado sensível nessas duas tabelas, então o trade-off é aceitável.
