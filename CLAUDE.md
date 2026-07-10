# KTracker CRM — arquitetura e convenções

Sistema próprio de tracking server-side + CRM + dashboard em tempo real,
**multi-oferta**. Substitui GTM + Stape + UTMify para infoprodutos vendidos
na Hotmart com tráfego pago via Meta Ads. Ver o prompt original completo em
`docs/prompt-original.md` (se presente) para o escopo funcional detalhado.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Componentes de UI no padrão shadcn/ui (escritos à mão em `components/ui/`
  — o CLI `shadcn` não teve acesso de rede neste ambiente; os componentes
  seguem exatamente a mesma API/estrutura, então `npx shadcn add <x>` volta
  a funcionar normalmente assim que houver rede)
- Supabase (Postgres + Auth + Realtime), acessado via `@supabase/ssr`
- Recharts (gráficos), lucide-react (ícones)
- Validação: Zod em toda entrada de formulário/API
- Deploy: Vercel + Vercel Cron

## Arquitetura

```
Páginas de vendas (3+ ofertas) → track.js → /api/track → Meta CAPI + GA4 MP
                                                  ↓
                                          Supabase (Postgres)
  visitors, events, sales, ad_spend ← /api/webhooks/hotmart
                                     ← /api/cron/meta-spend
                                                  ↓ (Realtime)
                                          Dashboard Next.js
```

**Entidade central: `offers`.** Nada no sistema é hardcoded para uma única
página — banco, APIs e dashboard são todos escopados por `offer_id`. O
dashboard permite visão consolidada (todas as ofertas) e visão individual.

### O vinculador único (visitor_id → venda)

1. `track.js` gera um `visitor_id` (UUID v4) na primeira visita, salvo em
   cookie first-party (1 ano) + localStorage.
2. Captura UTMs, `fbclid`, `fbp`, `fbc`, `ga_client_id`, referrer, landing
   page, IP/geo (resolvido no server), user agent.
3. Todo link de checkout Hotmart na página é reescrito automaticamente para
   incluir `?sck={visitor_id}&src={utm_source}`.
4. O webhook da Hotmart devolve o `sck` → o sistema casa a venda com o
   visitante → jornada completa: anúncio → clique → página → checkout →
   compra.
5. Sem `sck` (venda orgânica/direta): tentar match por e-mail (leads
   capturados); por último, "sem atribuição".

### Convenção de UTM obrigatória

Para o dashboard conseguir fazer o join exato entre venda e gasto por
campanha/criativo, os anúncios devem usar:

```
utm_campaign = {{campaign.id}}--{{campaign.name}}
utm_content  = {{ad.id}}--{{ad.name}}
utm_medium   = {{adset.id}}--{{adset.name}}
```

### Nomes de eventos padrão

`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`,
`Lead` — mais eventos customizados livres. O `event_id` (UUID) de cada
evento deve ser reaproveitado pelo pixel do navegador (quando houver) para
deduplicação client/server na Meta.

## Schema do banco

Migrations versionadas em `supabase/migrations/`. `0001_init.sql` cria:

- **offers** — dados de cada oferta. Segredos (token CAPI, GA4 api secret)
  **não** ficam no banco — só a referência ao nome da env var
  (`meta_capi_token_ref`, `ga4_api_secret_ref`). O valor real vive na Vercel.
- **visitors** — 1 registro por `visitor_id`, com UTMs/cookies/geo do
  primeiro contato.
- **events** — todo evento de tracking, com snapshot de UTMs e status de
  envio à Meta/GA4 (`meta_status`, `meta_response`, `ga4_status`).
- **leads** — captura própria e/ou abandono de carrinho Hotmart.
- **sales** — vendas via webhook Hotmart, com UTMs herdadas do visitante e
  `campaign_id`/`adset_id`/`ad_id` extraídos da convenção de UTM acima.
- **ad_spend** — gasto sincronizado da Meta Marketing API, unique por
  `(date, ad_id)`.
- **webhook_logs** — auditoria de tudo que chega (Hotmart, Meta).

RLS habilitado em todas as tabelas. Política atual: qualquer usuário
`authenticated` tem acesso total (sistema single-user, dono da conta —
preparado para virar multi-usuário depois via policies por `user_id`/tenant).
Rotas server-only (`/api/track`, webhooks, crons) usam a **service role
key** (`lib/supabase/admin.ts`), que ignora RLS.

## Variáveis de ambiente

Ver `.env.example` — documenta cada uma. Resumo:

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server (respeita RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | rotas server-only, ignora RLS |
| `HOTMART_HOTTOK` | valida o header `hottok` no webhook |
| `META_CAPI_TOKEN_<OFERTA>` | token CAPI por oferta (nome referenciado em `offers.meta_capi_token_ref`) |
| `META_TEST_EVENT_CODE_<OFERTA>` | validação no Test Events da Meta |
| `META_MARKETING_API_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` | cron de gasto (Sprint 4) |
| `GA4_API_SECRET_<OFERTA>` | GA4 Measurement Protocol por oferta |
| `NEXT_PUBLIC_APP_URL` | usada em CORS e nos snippets de instalação |

## Comandos

```bash
npm run dev
npm run build
npm run lint
```

## Segurança & LGPD

- E-mail, telefone e `external_id` são hasheados em SHA-256 **antes** de
  qualquer envio à Meta; no banco, `sales.buyer_email_hash` guarda só o hash.
- `hottok` valida o webhook Hotmart; CORS de `/api/track` restrito aos
  domínios cadastrados em `offers.domain`.
- Toda integração externa (Meta, GA4, Hotmart) tem tratamento de erro que
  vira log (`webhook_logs`, `events.meta_status`) — nunca deve derrubar a
  página de vendas do cliente nem quebrar o webhook.

## Roadmap de Sprints

1. **✅ Sprint 1 — Fundação:** Next.js + Tailwind + shadcn, migrations
   completas, auth do painel, CRUD de ofertas, shell do dashboard.
2. **Sprint 2 — Tracking:** `public/track.js` + `/api/track` + envio Meta
   CAPI/GA4 com dedup e hashing SHA-256 + vinculador `sck` + validação com
   `test_event_code`.
3. **Sprint 3 — Hotmart:** `/api/webhooks/hotmart` completo, casamento
   venda↔visitante, `Purchase` server-side, leads de abandono, logs.
4. **Sprint 4 — Meta Spend:** `/api/cron/meta-spend` (Marketing API),
   Vercel Cron, backfill manual, join campanha/criativo via UTM.
5. **Sprint 5 — Dashboard:** KPIs, funil, gráficos temporais, tabela de
   campanhas/criativos, filtros dinâmicos, Supabase Realtime.
6. **Sprint 6 — CRM & polish:** perfil do visitante com timeline de eventos
   + payloads Meta, página de configurações completa (teste de conexão),
   responsivo, ajustes visuais finais.

Cada sprint: apresentar plano → implementar → checklist de testes manuais →
commit descritivo.

## Identidade visual

Tema dark forte: fundo `#0A0E14`, superfícies `#111722`, bordas `#1E2733`.
Verde neon `#22FF88` (positivo/ROAS, com glow), âmbar `#FFB020` (alertas),
vermelho `#FF4757` (reembolso/prejuízo). Fonte Inter (UI) + JetBrains Mono
(todos os números/KPIs, via classe `.font-mono-nums`). Tokens de cor em
`app/globals.css` (`@theme inline`), usados como `bg-background`,
`text-accent`, `border-border` etc.
