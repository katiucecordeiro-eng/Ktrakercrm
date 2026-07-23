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

### Tracking (Sprint 2)

- `public/track.js`: script vanilla (sem dependências, fora do bundle
  TypeScript — ignorado pelo ESLint do projeto). Gera/recupera o
  `visitor_id`, captura UTMs/fbclid da URL, gera `_fbp`/`_fbc` compatíveis
  com o formato da Meta quando o pixel do navegador não está presente,
  reescreve links de checkout Hotmart (`sck` + `src`) tanto no load quanto
  via `MutationObserver` e delegação de clique, dispara `PageView`
  automático (+ `Scroll50`/`Scroll90` e `PageDuration` no unload) e expõe
  `window.trk(eventName, customData)` / `window.trk.lastEventId`. Envia via
  `navigator.sendBeacon` (fallback `fetch(..., keepalive: true)`); nunca
  lança exceção que quebre a página de vendas.
- `app/api/track/route.ts`: valida o payload (Zod), resolve a oferta pelo
  `offer_slug`, faz upsert de `visitor` (first-touch preservado — só
  atualiza `last_seen_at` e completa `fbp`/`fbc`/`ga_client_id` se
  estavam vazios) e insere o `event`. Responde rápido e processa o envio
  para Meta CAPI + GA4 MP depois, via `after()` do `next/server`, sem
  atrasar o beacon do navegador. Atualiza `events.meta_status` /
  `meta_response` / `ga4_status` ao final.
- `lib/meta/capi.ts` / `lib/ga4/measurement-protocol.ts`: montam e enviam
  os eventos (1 retry com backoff via `lib/utils/fetch-retry.ts`). `email`/
  `phone` do `custom_data` viram `em`/`ph` hasheados em SHA-256 no
  `user_data` da Meta (`lib/crypto/hash.ts`) e são removidos do
  `custom_data`/params antes de repassar a GA4 (nunca PII em texto puro
  fora do `user_data`).
- `test_event_code`: por convenção de env var, sem precisar de coluna no
  banco — `META_TEST_EVENT_CODE_<SLUG-EM-MAIÚSCULAS-COM-UNDERSCORE>` (ver
  `lib/meta/capi.ts#metaTestEventCodeEnvName`).
- Geo (cidade/estado/país) é lida dos headers `x-vercel-ip-*`, presentes
  automaticamente em produção na Vercel; localmente ficam vazios (não é um
  serviço de geo-IP à parte).
- CORS de `/api/track` é resolvido por `lib/cors.ts` comparando a `Origin`
  do request com `offers.domain`; permissivo enquanto a oferta não tem
  domínio cadastrado.
- Rate limit (`lib/rate-limit.ts`) é em memória, por IP, por processo —
  suficiente como proteção básica; não é distribuído entre instâncias
  serverless (upgrade futuro: Upstash Redis, se o tráfego justificar).

### Webhooks Hotmart (Sprint 3)

- `app/api/webhooks/hotmart/route.ts`: valida `hottok` (header `hottok`,
  com fallback para o campo `hottok` no corpo do JSON) contra
  `HOTMART_HOTTOK`; se a env var não estiver definida, a validação é
  pulada (útil em desenvolvimento). Todo payload recebido é gravado em
  `webhook_logs` (`processed`, `ignored_event`, `invalid_hottok`,
  `invalid_payload` ou `error`), mesmo quando o Supabase está fora do ar
  (nesse caso responde 200 sem gravar, e loga no console).
- **Importante:** o formato exato do payload da Hotmart (em especial onde
  vêm os parâmetros de rastreamento `sck`/`src`) não pôde ser confirmado
  contra a documentação ao vivo neste ambiente (sem acesso de rede aos
  domínios da Hotmart). `lib/hotmart/extract.ts` tenta múltiplos caminhos
  plausíveis (`purchase.tracking.source_sck`, `purchase.origin.sck`,
  `purchase.sck`, `sck` no topo, etc.) e o payload bruto sempre fica em
  `webhook_logs.payload` — **assim que chegar o primeiro webhook real,
  conferir ali o caminho correto e ajustar os extratores se necessário.**
- Resolve a oferta por `product.id` comparando com
  `offers.hotmart_product_ids` (`array.contains`). Casa a venda com o
  visitante por `sck` (que é o próprio `visitor_id`); sem match, tenta pelo
  e-mail do comprador na tabela `leads` (lead mais recente com esse
  e-mail); sem nenhum dos dois, a venda fica sem atribuição
  (`visitor_id`/UTMs nulos).
- `sales` é gravada via `upsert` por `hotmart_transaction_id` — reentregas
  do mesmo webhook (ou eventos sequenciais da mesma transação, ex.
  aprovado → reembolsado) atualizam a mesma linha em vez de duplicar.
- `net_value` fica `null` por enquanto — depende do detalhamento de
  comissão (`data.commissions`) que também não pôde ser validado; calcular
  isso é candidato a ajuste fino quando houver payloads reais para
  inspecionar.
- `Purchase` só é disparado para Meta CAPI + GA4 **na primeira vez** que a
  transação vira `approved` (comparação com o status anterior salvo no
  banco) — reentregas do webhook não duplicam a conversão no Meta/GA4.
  Reembolso/chargeback/cancelamento só atualizam `sales.status` (sem
  disparo à Meta — não há um evento nativo de "estorno" na CAPI).
- `PURCHASE_OUT_OF_SHOPPING_CART` (abandono de carrinho) grava um registro
  em `leads` com `source = 'hotmart_cart_abandonment'`, sem criar venda.

### Backfill de vendas retroativas (pós-lançamento)

Botão "Vendas retroativas" em Configurações → Ofertas — importa vendas que
já existiam na Hotmart antes do webhook estar configurado (o webhook só
recebe eventos novos, nunca histórico).

- `lib/hotmart/api-client.ts`: autentica via OAuth2 `client_credentials`
  (`HOTMART_CLIENT_ID`/`HOTMART_CLIENT_SECRET`, globais — a Hotmart gera um
  Client ID/Secret por conta, não por produto) e pagina o endpoint de
  histórico de vendas por `product_id` (um dos `offers.hotmart_product_ids`
  por vez).
- `lib/hotmart/sync-sales.ts`: reaproveita os mesmos extratores do webhook
  (`lib/hotmart/extract.ts`) para mapear cada item pro formato de `sales`,
  com `resolveVisitor` (`lib/hotmart/resolve-visitor.ts`, compartilhado com
  o webhook) tentando casar por sck/e-mail — a maioria das vendas antigas
  não vai casar (tracking não existia na época), o que é esperado.
  **Nunca dispara Purchase para Meta CAPI/GA4**: são vendas antigas, e
  reenviar duplicaria a conversão (o webhook já disparou na época, se
  existia) além da Meta rejeitar/penalizar eventos com `event_time` fora
  da janela de poucos dias aceita pela CAPI.
- **Mesma ressalva do webhook**: o formato exato da resposta do endpoint de
  histórico (`SALES_HISTORY_STATUS` em `extract.ts`, campos de
  `purchase.status`/`approved_date`) não pôde ser confirmado contra a
  documentação ao vivo neste ambiente — conferir `sales.raw_payload` das
  primeiras vendas importadas e ajustar os extratores se algum campo não
  bater.

### Sincronização de gasto Meta (Sprint 4)

- `app/api/cron/meta-spend/route.ts` (`GET`): a cada execução resincroniza
  os **últimos 3 dias** (a Meta ajusta gasto/impressões com atraso) para
  todas as ofertas ativas com `meta_ad_account_id` preenchido. Protegido
  por `CRON_SECRET` — a Vercel injeta `Authorization: Bearer
  <CRON_SECRET>` automaticamente nas chamadas do Cron quando essa env var
  está definida; sem ela, a rota fica aberta (conveniente em dev).
- **Vercel Cron no plano Hobby só permite 1 execução/dia.** `vercel.json`
  está configurado para `0 9 * * *` (1x/dia, às 9h). **Atenção:** um
  schedule mais frequente que 1x/dia (ex.: `0 * * * *`, a cada hora) faz a
  Vercel **recusar o deploy inteiro** no plano Hobby — não é um ajuste
  automático de frequência, é falha de build. Isso já aconteceu neste
  projeto (todos os deploys entre a Sprint 4 e a correção falhavam
  silenciosamente por causa disso). Se migrar para o plano Pro, pode
  voltar para um schedule mais frequente.
- `lib/meta/marketing-api.ts`: busca Insights (`level: ad`,
  `time_increment: 1`) com paginação. `lib/meta/sync-ad-spend.ts`: upsert
  em `ad_spend` por `(date, ad_id)`, calculando `cpc`/`cpm`.
- Backfill manual: botão "Sincronizar gasto" em Configurações → Ofertas
  (período customizável), via Server Action — usa o client autenticado do
  painel, não expõe uma rota pública de escrita.
- `offers.meta_ad_account_id` (migration `0002`) guarda o ID da conta de
  anúncio (com ou sem prefixo `act_`) usado nessa sincronização.
- **Gasto total da conta (nível de conta, não de campanha)**:
  `lib/meta/account-info.ts#fetchMetaAccountInfo` consulta
  `act_{id}?fields=currency,amount_spent,balance,spend_cap` na Graph API —
  totais históricos da conta, não a granularidade diária do
  `ad_spend`/Insights. Botão "Saldo Meta" em Configurações → Ofertas
  (`account-spend-dialog.tsx` + `getMetaAccountSpend` em
  `test-actions.ts`) busca sob demanda (não é persistido em tabela).
  **Assunção não validada contra uma conta real**: `amount_spent`/`balance`/
  `spend_cap` costumam vir na Graph API na menor unidade da moeda (ex.
  centavos) — o código divide por 100, exceto para uma lista conhecida de
  moedas sem casas decimais (JPY, KRW etc.); confirmar o valor exibido
  contra o Gerenciador de Anúncios na primeira consulta real. A Graph API
  não expõe um campo separado de "impostos" da conta — isso só aparece no
  detalhamento de fatura (Gerenciador de Anúncios → Faturamento), fora do
  escopo da Marketing API; a tela deixa esse aviso explícito para a
  usuária.

### Dashboard (Sprint 5)

- **Views SQL** (migration `0003`): `daily_metrics`, `funnel_by_offer` e
  `campaign_performance` pré-agregam `sales`/`events`/`ad_spend` por dia
  (e por campanha/conjunto/anúncio, no caso da última) — o servidor
  Next.js consulta essas views já pequenas e só faz o reagrupamento leve
  por semana/mês em `lib/reports/queries.ts`, nunca soma linha a linha de
  `sales`/`events` cruas. Todas com `security_invoker = true` para
  respeitar a RLS de quem consulta.
- `lib/reports/filters.ts`: resolve os presets de período (hoje, ontem,
  7d, 30d, este mês, mês passado, personalizado) e a oferta selecionada a
  partir da URL (`?period=...&offer=...&since=...&until=...`), e escolhe
  a granularidade do gráfico temporal (hora/dia/semana/mês) conforme o
  tamanho do intervalo.
- `lib/reports/queries.ts`: `getKpis`, `getFunnel`, `getTimeSeries`,
  `getCampaignTable`, `getPaymentBreakdown`, `getHourlyBreakdown`,
  `getRegionRanking` — cada uma consulta as views/tabelas e devolve dados
  já prontos para os componentes.
- **Simplificações assumidas** (documentar para revisar quando houver
  dados reais): `sales.net_value` ainda não é calculado (Sprint 3), então
  "Faturamento líquido" = bruto − reembolsos (sem descontar taxa da
  Hotmart); o "Lucro" da série temporal não desconta o imposto por oferta
  quando "todas as ofertas" está selecionado (o KPI card de Lucro
  desconta corretamente, ponderado por oferta).
- Granularidade "hora" (períodos de 1 dia) usa `sales.approved_at`
  diretamente por não existir quebra horária em `ad_spend`; o gasto é
  distribuído igualmente pelas 24h como aproximação.
- Tabela de campanhas é expansível (campanha → conjunto → anúncio) via
  estado no client (`campaign-table.tsx`); badge verde quando ROAS ≥ 2x
  (`ROAS_THRESHOLD`, ainda uma constante — vira configurável num ajuste
  futuro).
- **Log de eventos ao vivo**: `live-event-log.tsx` assina
  `postgres_changes` (INSERT em `events`) via Supabase Realtime. Exige
  `alter publication supabase_realtime add table events;` (migration
  `0004`) — sem isso, o Realtime simplesmente não emite nada (sem erro
  visível).
- Sem Supabase configurado, a Visão Geral cai no aviso padrão em vez de
  tentar renderizar os gráficos (mesma convenção das sprints anteriores).
- **Atualização automática**: `components/layout/auto-refresh.tsx`
  (montado no layout do dashboard, só quando Supabase está configurado)
  chama `router.refresh()` a cada 30s e também quando a aba volta a ficar
  visível/em foco — refaz o fetch dos Server Components da rota atual
  (KPIs, funil, gráficos, tabelas) sem precisar de F5 manual. Cobre tudo
  que não é Realtime (só o log de eventos ao vivo usa Realtime de fato).
  **Importante**: isso só relê o banco — vendas/eventos da Hotmart mudam
  em tempo real (webhook), mas gasto/cliques/impressões da Meta só mudam
  quando alguém sincroniza de fato com a Marketing API.
- **Botão "Atualizar" manual**: ao lado do seletor de período na Visão
  Geral (`refresh-button.tsx` + `refreshDashboardDataAction` em
  `refresh-actions.ts`). Diferente do auto-refresh, esse dispara de
  verdade um `syncAllOffers` (mesma função do cron) pros últimos 3 dias de
  todas as ofertas ativas antes de revalidar a página — por isso ele
  "atualiza e sincroniza tudo" como pedido, não só reler o banco.
- **Vendas por produto** (`getSalesByProduct` em `queries.ts` +
  `product-sales-chart.tsx`): agrupa `sales` (status `approved`, no
  período) por `product_id`, mostrando valor bruto e % de participação —
  direto da tabela `sales`, não de uma view, já que `product_id`/
  `product_name` vêm do próprio payload da Hotmart por venda (sem
  depender do catálogo cadastrado na oferta). Cadastrar os produtos em
  `offers.hotmart_product_ids` (ver "Produtos Hotmart" abaixo) não afeta
  esse gráfico — ele funciona mesmo sem cadastro prévio.

### Produtos Hotmart da oferta

Campo "Produtos Hotmart" em Configurações → Ofertas
(`offer-form-dialog.tsx#ProductIdsField`) — chips com adicionar/remover
por ID (Enter ou vírgula adiciona), em vez do input único de texto separado
por vírgula original. Continua salvando em `offers.hotmart_product_ids`
(text[]) sem mudança de schema; usado pelo webhook da Hotmart para
resolver a oferta a partir de `product.id` (`array.contains`).

### CRM & polish (Sprint 6)

- **View `visitor_summary`** (migration `0005`): agrega cada visitante com
  o lead mais recente (`leads`, por `created_at desc`), o status de venda
  prioritário (reembolso/chargeback > aprovada > outro) e a contagem de
  eventos — usada pela busca em `/dashboard/visitors`.
- **Limitação conhecida de busca por e-mail**: `sales` só guarda
  `buyer_email_hash` (hash SHA-256, por LGPD) — não há e-mail em texto
  puro do comprador nessa tabela. A busca por e-mail em
  `/dashboard/visitors` só encontra quem passou por `leads` (formulário
  próprio ou abandono de carrinho); um comprador que nunca gerou lead só é
  localizável pelo `visitor_id`.
- **Status do visitante** (`lib/crm/queries.ts#deriveStatus`): reembolsado
  > comprador > lead > visitante — nessa ordem de prioridade.
- `/dashboard/visitors/[id]`: perfil com dados brutos do visitante (fbp,
  fbc, ga_client_id, IP, UA, geo) + timeline de eventos
  (`event-timeline.tsx`) expansível mostrando `meta_response` (payload
  exato devolvido pela Meta) e os status `meta_status`/`ga4_status`.
- **Diagnóstico de conexão** (`connection-test-dialog.tsx` +
  `test-actions.ts`): "Testar" dispara uma chamada real — um `PageView`
  de teste para a Meta CAPI (aparece no Test Events se
  `META_TEST_EVENT_CODE_<OFERTA>` estiver configurado) e uma consulta de
  1 dia à Marketing API. `recent-webhooks.tsx` lista as últimas 10
  entregas do webhook Hotmart (`webhook_logs`) para depuração.
- **Responsivo**: sidebar vira um drawer off-canvas abaixo do breakpoint
  `md` (`components/layout/mobile-sidebar-context.tsx` +
  `mobile-menu-button.tsx`), com overlay e fechamento automático ao
  navegar.

### Segredos por oferta (pós-lançamento)

Depois do primeiro deploy, o fluxo original de "token = referência a nome
de env var" (uma env var por oferta/token na Vercel) foi trocado por
**tokens colados direto no formulário**, para não precisar redeployar/criar
env var toda vez que uma oferta nova é cadastrada:

- `lib/crypto/secrets.ts`: `encryptSecret`/`decryptSecret` (AES-256-GCM)
  usando a única env var `SECRETS_ENCRYPTION_KEY` como chave. Formato
  salvo no banco: `"<iv base64>.<authTag base64>.<ciphertext base64>"`.
- Migration `0006`: colunas `offers.meta_capi_token`, `offers.meta_ads_token`
  e `offers.ga4_api_secret` guardam o ciphertext (nunca o token em texto
  puro).
- Formulário de oferta (`offer-form-dialog.tsx`): os 3 campos de token são
  `type="password"`, sempre vazios ao abrir — o valor atual só aparece
  mascarado (`••••••` + 6 últimos caracteres, calculado em
  `page.tsx`/`maskSecret` no servidor) como `placeholder`. Deixar o campo
  em branco ao salvar preserva o token já salvo (`actions.ts` omite a
  coluna do `update` quando o campo vem vazio); colar um valor novo
  substitui.
- `lib/meta/capi.ts`, `lib/ga4/measurement-protocol.ts`,
  `lib/meta/sync-ad-spend.ts#resolveMetaAdsToken`: descriptografam o token
  da oferta na hora de usar — nunca ficam em variável fora dessas funções.
  O token da Marketing API tem fallback para o antigo
  `META_MARKETING_API_ACCESS_TOKEN` global, caso uma oferta não tenha
  `meta_ads_token` próprio ainda.
- Se `SECRETS_ENCRYPTION_KEY` mudar depois de tokens já salvos, esses
  tokens ficam ilegíveis (a descriptografia falha silenciosamente,
  tratada como "não configurado") — é preciso recolar os tokens.

## Schema do banco

Migrations versionadas em `supabase/migrations/`. `0001_init.sql` cria:

- **offers** — dados de cada oferta, incluindo `meta_ad_account_id`
  (migration `0002`, conta de anúncio usada no sync de gasto). Token CAPI,
  token da Marketing API e GA4 API secret são colados direto no formulário
  e guardados **criptografados** (AES-256-GCM, `lib/crypto/secrets.ts`) nas
  colunas `meta_capi_token`/`meta_ads_token`/`ga4_api_secret` (migration
  `0006`) — a chave de criptografia (`SECRETS_ENCRYPTION_KEY`) é a única
  env var envolvida, definida uma vez só, nunca por oferta. As colunas
  antigas `meta_capi_token_ref`/`ga4_api_secret_ref` (referência a nome de
  env var) ficam no schema mas não são mais lidas por nenhum código —
  substituídas por esse fluxo depois do lançamento inicial.
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
| `SECRETS_ENCRYPTION_KEY` | criptografa os tokens colados por oferta (Meta CAPI, Marketing API, GA4) — única, gerada uma vez, nunca por oferta |
| `HOTMART_HOTTOK` | valida o header `hottok` no webhook |
| `HOTMART_CLIENT_ID` / `HOTMART_CLIENT_SECRET` | API de Vendas da Hotmart, só para o backfill manual de vendas retroativas |
| `META_TEST_EVENT_CODE_<OFERTA>` | validação no Test Events da Meta (ainda por env var, derivada do slug) |
| `META_MARKETING_API_ACCESS_TOKEN` | fallback legado se uma oferta não tiver `meta_ads_token` próprio configurado |
| `CRON_SECRET` | protege `/api/cron/meta-spend`; a Vercel injeta o header automaticamente quando definida |
| `NEXT_PUBLIC_APP_URL` | usada em CORS e nos snippets de instalação |

Token CAPI (`offers.meta_capi_token`), token da Marketing API
(`offers.meta_ads_token`) e GA4 API secret (`offers.ga4_api_secret`) **não**
são env vars — são colados direto no formulário de cada oferta em
Configurações e salvos criptografados no banco (ver seção "Segredos por
oferta" abaixo).

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
2. **✅ Sprint 2 — Tracking:** `public/track.js` + `/api/track` + envio Meta
   CAPI/GA4 com dedup e hashing SHA-256 + vinculador `sck` + validação com
   `test_event_code`.
3. **✅ Sprint 3 — Hotmart:** `/api/webhooks/hotmart` completo, casamento
   venda↔visitante, `Purchase` server-side, leads de abandono, logs.
4. **✅ Sprint 4 — Meta Spend:** `/api/cron/meta-spend` (Marketing API),
   Vercel Cron, backfill manual, join campanha/criativo via UTM.
5. **✅ Sprint 5 — Dashboard:** KPIs, funil, gráficos temporais, tabela de
   campanhas/criativos, filtros dinâmicos, Supabase Realtime.
6. **✅ Sprint 6 — CRM & polish:** perfil do visitante com timeline de
   eventos + payloads Meta, página de configurações completa (teste de
   conexão), responsivo, ajustes visuais finais.

Todas as 6 sprints do escopo original estão completas. Próximos ajustes
finos ficam a critério do uso real (ver limitações documentadas em cada
seção acima — sobretudo o formato do payload da Hotmart, nunca validado
contra uma entrega real).

Cada sprint: apresentar plano → implementar → checklist de testes manuais →
commit descritivo.

## Identidade visual

Tema dark forte: fundo `#0A0E14`, superfícies `#111722`, bordas `#1E2733`.
Verde neon `#22FF88` (positivo/ROAS, com glow), âmbar `#FFB020` (alertas),
vermelho `#FF4757` (reembolso/prejuízo). Fonte Inter (UI) + JetBrains Mono
(todos os números/KPIs, via classe `.font-mono-nums`). Tokens de cor em
`app/globals.css` (`@theme inline`), usados como `bg-background`,
`text-accent`, `border-border` etc.
