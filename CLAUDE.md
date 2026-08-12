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

Botão **"UTMs para Meta Ads"** em Configurações → Ofertas
(`utm-template-dialog.tsx`) copia a string pronta pro campo "Parâmetros
de URL" do Gerenciador de Anúncios — um só template serve pra todas as
ofertas/campanhas, já que os `{{...}}` são preenchidos pela própria Meta
por anúncio (não é um valor por oferta, por isso o botão fica uma vez só
na página, não repetido por linha).

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
  lança exceção que quebre a página de vendas. **Modo debug** (opt-in via
  `?ktrk_debug=1` na URL, persiste em `localStorage`): troca o
  `sendBeacon` fire-and-forget por `fetch` com leitura da resposta e loga
  no console cada evento aceito/rejeitado — sem isso, um 404 do servidor
  (ex. oferta inativa) é completamente invisível no navegador, já que
  `sendBeacon` nunca expõe a resposta. Também avisa distintamente quando
  `document.currentScript` é `null` (script injetado via JS/innerHTML em
  vez de tag HTML estática — quebra a leitura do `data-offer`).
- **Diagnóstico de rastreamento** (`connection-test-dialog.tsx` +
  `track-test-actions.ts`): dispara um evento sintético (`DiagnosticPing`,
  fora da lista de eventos padrão — não polui funil/KPIs) direto no
  `/api/track` da própria oferta, pelo mesmo caminho que o `track.js` usa,
  com o slug editável (pra comparar contra o `data-offer` real da página).
  Existe porque um 404 de "oferta não encontrada" no tracking real é
  silencioso (o beacon nunca lê a resposta) — esse botão testa o mesmo
  caminho e mostra o resultado na tela, sem precisar de acesso ao banco ou
  à página ao vivo.
- `app/api/track/route.ts`: valida o payload (Zod), resolve a oferta pelo
  `offer_slug` (`ilike`, case-insensitive — evita que uma diferença de
  maiúscula/minúscula entre o `data-offer` e `offers.slug` derrube o
  evento sem nenhum aviso), faz upsert de `visitor` (first-touch preservado — só
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
- `test_event_code`: campo `offers.meta_test_event_code` (migration `0014`,
  pós-lançamento) — colado direto no formulário da oferta, em texto puro
  (não é segredo, a própria Meta exibe esse código na tela de Test
  Events). Fallback pra env var legada `META_TEST_EVENT_CODE_<SLUG-EM-MAIÚSCULAS-COM-UNDERSCORE>`
  (ver `lib/meta/capi.ts#metaTestEventCodeEnvName`) só pra quem configurou
  antes desse campo existir — cadastrar uma oferta nova não depende mais
  de nenhuma env var por slug.
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
  por vez). **O header `Authorization: Basic` do endpoint de token não é
  `base64(client_id:client_secret)` calculado por nós** — é um terceiro
  valor que a própria Hotmart mostra na tela de credenciais
  (`HOTMART_BASIC_TOKEN`); sem ele, o token retorna 401 mesmo com
  client_id/secret corretos.
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
- **Server Actions de sync também esbarram em limite da Vercel**: no
  plano Hobby, toda função serverless (inclusive Server Actions) é morta
  em 10s por padrão — um período longo com paginação (vendas retroativas
  Hotmart, gasto Meta) passa disso fácil, e o botão fica preso em
  "Sincronizando..." sem erro nenhum (a Vercel mata a função no meio,
  sem resposta JSON pra tratar). Corrigido com `export const maxDuration
  = 60` (máximo do Hobby) — **mas no `page.tsx` que renderiza o
  formulário, não no arquivo da action**: Server Actions herdam o
  `maxDuration` da rota que as invoca; um arquivo `"use server"` só pode
  exportar funções async, então colocar `maxDuration` lá quebra o build
  inteiro (`next build` rejeita qualquer export que não seja uma action).
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
  futuro). Linhas de criativo (anúncio) têm fundo verde-claro
  (`bg-accent/10`) pra se destacar visualmente dos conjuntos (cinza).
  Botão "Mais colunas" revela Impressões/Alcance/Frequência/CPC/CPM
  (migration `0007` adiciona `reach`/`frequency` em `ad_spend`, buscados
  na Meta Insights junto com spend/impressions/clicks). **Frequência é
  recalculada como impressões/alcance** em vez de somar/tirar média das
  frequências diárias (evita distorcer o valor); **alcance somado no
  período é uma aproximação** — a Meta não deduplica alcance entre dias
  somados, só dentro de um único `time_range` por chamada.
- **Atribuição de venda a campanha depende 100% da convenção de UTM**
  (`utm_campaign`/`utm_medium`/`utm_content` = `{{id}}--{{name}}`, ver
  seção acima). Se os anúncios reais não usarem exatamente esse formato,
  `sales.campaign_id`/`adset_id`/`ad_id` ficam nulos e a linha da campanha
  mostra gasto sincronizado mas "Vendas: 0"/"CPA: —", mesmo com vendas
  reais no período (elas só não têm como ser somadas àquela campanha
  específica — continuam contando nos KPIs gerais/vendas por produto).
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
| `HOTMART_CLIENT_ID` / `HOTMART_CLIENT_SECRET` / `HOTMART_BASIC_TOKEN` | API de Vendas da Hotmart, só para o backfill manual de vendas retroativas — as 3 vêm da mesma tela de credenciais |
| `META_TEST_EVENT_CODE_<OFERTA>` | fallback legado — o código de Test Events agora é o campo `offers.meta_test_event_code` no formulário; só usada se a oferta não tiver esse campo preenchido |
| `META_MARKETING_API_ACCESS_TOKEN` | fallback legado se uma oferta não tiver `meta_ads_token` próprio configurado |
| `CRON_SECRET` | protege `/api/cron/meta-spend`; a Vercel injeta o header automaticamente quando definida |
| `NEXT_PUBLIC_APP_URL` | usada em CORS e nos snippets de instalação |

Token CAPI (`offers.meta_capi_token`), token da Marketing API
(`offers.meta_ads_token`) e GA4 API secret (`offers.ga4_api_secret`) **não**
são env vars — são colados direto no formulário de cada oferta em
Configurações e salvos criptografados no banco (ver seção "Segredos por
oferta" abaixo).

### Cadastrar uma oferta nova (multi-oferta, sem tocar em Vercel/Supabase)

Todas as env vars acima são **globais, configuradas uma única vez** (uma
conta Hotmart, uma chave de criptografia, um app na Vercel) — nenhuma delas
é por oferta. Cadastrar a 2ª, 3ª, 4ª... oferta é 100% pelo formulário em
Configurações → Ofertas → "Nova oferta", sem precisar editar nada na
Vercel nem no Supabase:

1. **Nova oferta** no formulário: nome, slug (usado no `data-offer` do
   snippet), domínio real da página (ativa CORS restrito — sem isso, fica
   permissivo, o que funciona mas é menos seguro), moeda, imposto (%), meta
   de ROAS e fuso horário (opcionais, default 2x/`America/Sao_Paulo`).
2. **Pixel da Meta**: criar um Pixel novo (ou reaproveitar um existente) no
   Gerenciador de Eventos da Meta para essa oferta/produto, colar o Pixel
   ID e gerar+colar um token de acesso da Conversions API (Configurações do
   Pixel → Conversions API → Gerar token de acesso).
3. **Conta de anúncio** (se for rodar Meta Ads pra essa oferta): Ad Account
   ID + um token da Marketing API com permissão `ads_read`/`ads_management`
   nessa conta (token de longa duração, não o de 1-2h do Graph API
   Explorer — ver conversa anterior sobre o problema de token de curta
   duração).
4. **GA4** (se for usar): Measurement ID + API secret (Admin → Fluxos de
   dados → API secrets, no GA4).
5. **Produtos Hotmart**: adicionar o(s) ID(s) numérico(s) do(s) produto(s)
   dessa oferta (chips, Enter pra adicionar) — é assim que o webhook
   (URL única, já configurada, compartilhada por todas as ofertas da mesma
   conta Hotmart) sabe pra qual oferta cada venda pertence.
6. **Instagram** (opcional, Meta Intelligence): Instagram Business Account
   ID + token com `instagram_basic`/`instagram_insights`.
7. **Código de Test Events da Meta** (opcional, só validação): colar o
   código que a própria Meta mostra em Gerenciador de Eventos → Test
   Events.
8. **Instalar o `track.js`** na página nova: botão "Instalação" na linha
   dessa oferta gera o snippet pronto (já com o slug certo) pra colar no
   WordPress (footer/header, via plugin de código ou Elementor Pro Custom
   Code — ver `install-snippet-dialog.tsx`).
9. **Rodar o diagnóstico** ("Diagnóstico" na linha da oferta): testa Meta
   CAPI, Marketing API e o caminho do `/api/track` de ponta a ponta antes
   de considerar a oferta pronta.
10. Se a oferta já tiver vendas históricas na Hotmart antes de configurar
    o webhook: usar "Vendas retroativas" pra importar o histórico.

Nenhum desses passos exige redeploy, migration nova ou variável de
ambiente — o único motivo pra mexer na Vercel seria trocar uma env var
**global** (ex. rotacionar `HOTMART_HOTTOK` se a Hotmart mudar o token da
conta), o que não tem relação com quantas ofertas existem.

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

### Redesign visual + funil (pós-lançamento, "Sprint A/B")

Segunda rodada pedida pela usuária: redesign visual + diagnóstico de por
que o funil ficava zerado. Escopo completo era 6 sprints (A–F); só A
(visual) e B (funil) foram feitos nesta rodada — C–F (CRM avançado,
página de campanhas com fallback de UTM, Meta Business Intelligence,
polish geral) ficam como roteiro para quando a usuária pedir.

- **Funil zerado**: causa raiz era `/api/track` responder 404 quando o
  slug não batia com nenhuma oferta ativa, mas `track.js` envia via
  `sendBeacon` (fire-and-forget) — o 404 nunca aparecia em lugar nenhum.
  Corrigido com match case-insensitive (`ilike`) + modo debug opt-in no
  `track.js` (`?ktrk_debug=1`) + diagnóstico em Configurações → Ofertas
  que testa o mesmo caminho do site real. Ver seção "Tracking (Sprint 2)"
  acima para os detalhes.
- **KPIs com tendência vs. período anterior**: `getPreviousPeriodFilters`
  (`lib/reports/filters.ts`) desloca o período pra trás pela mesma
  duração; `computeKpiDeltas` (`lib/reports/trends.ts`) calcula a
  variação % genérica sobre todos os campos numéricos de `KpiSummary`.
  `kpi-cards.tsx` virou Client Component (recebe `kpis`/`previousKpis`
  já prontos do servidor, mesmo padrão de `RevenueChart`/`CampaignTable`)
  pra poder usar `useCountUp` (`hooks/use-count-up.ts`) — a animação só
  conta do zero na primeira renderização; em renders seguintes (inclusive
  os disparados pelo `AutoRefresh` a cada 30s) anima a partir do valor
  anterior real, nunca reinicia do zero. **Direção da cor do delta é
  invertida** (`deltaInvert`) pra métricas de custo (CPA, taxa de
  reembolso, custo por checkout, vendas reembolsadas) — descer é bom
  nessas, ao contrário de receita/vendas. Gasto com anúncios é neutro
  (`deltaNeutral`, sem julgamento de cor) — gastar mais ou menos não é
  bom/ruim isoladamente. ROAS ≥ 2x ganha borda pulsante
  (`.animate-glow-pulse` em `globals.css`, keyframe separado do
  `pulse-live` do indicador AO VIVO).
- **Funil visual**: `funnel-chart.tsx` virou afunilado de verdade
  (`clip-path` trapezoidal calculado a partir da largura da etapa atual e
  da próxima), com badge de conversão colorido por faixa entre etapas
  (heurística: ≥40% verde, 15–40% âmbar, <15% vermelho — ajustável, não
  vem de nenhum benchmark) e toggle "Funil"/"Tabela". **Gradiente por
  etapa** (pós-lançamento, referência visual Utmify que a usuária mandou):
  cada segmento usa `linear-gradient` com `color-mix(in srgb, var(--color-accent) X%, transparent)`,
  `X` decrescente por índice da etapa (~92% no topo até ~35% na última) —
  verde forte no topo, afinando pro fundo escuro nas etapas finais; glow
  (`box-shadow`) só no primeiro segmento.
- **Etapas do funil ajustadas (pós-lançamento)**: removida "Adições ao
  carrinho" (a oferta não tem conceito de carrinho — sempre ficava
  zerada). "Checkouts iniciados" agora vem preferencialmente do
  `InitiateCheckout` reportado pela própria Meta (`ad_spend.meta_initiate_checkout`,
  migration `0008`, campo `actions` da Insights API) em vez de só do
  clique rastreado pelo `track.js` — o clique sub-contava bastante
  (chegou a mostrar menos checkouts do que vendas aprovadas, logicamente
  impossível) porque só conta cliques em `<a href>` de checkout Hotmart;
  cai pro rastreamento próprio só se a Meta não retornar nada (oferta sem
  Pixel/CAPI). **Nomes de `action_type` da Meta pra InitiateCheckout
  variam** (`initiate_checkout`, `omni_initiated_checkout`, etc.) — soma
  qualquer um conhecido, sem confirmação contra uma resposta real de
  conta com CAPI configurado. Nova etapa "Vendas iniciadas" (qualquer
  status de `sales`, por `created_at`) antes de "Vendas aprovadas"
  (só `status = 'approved'`) — eram uma etapa só antes.
- **Skeleton de loading**: novo `components/ui/skeleton.tsx`
  (`animate-pulse bg-surface-hover`), usado nos 2 `Suspense fallback`
  que antes eram `<div>` sem estilo nenhum (`layout.tsx`, `dashboard/page.tsx`).
- **"Elementos 3D/isométricos" do pedido original não são literais** —
  substituídos por `.dot-grid` (padrão de pontos em CSS puro,
  `globals.css`, aplicado no header do shell), já que ilustração 3D
  bespoke exigiria assets de design que não existem no projeto.
- **Sidebar**: item ativo ganha borda esquerda verde (`border-l-2
  border-accent`) além do fundo já existente; ícone desliza levemente
  (`group-hover:translate-x-0.5`) no hover.
- **Botão "texto deslizante" do pedido original não foi implementado
  literalmente** — exigiria duplicar `children` numa estrutura de `span`,
  o que quebraria o padrão `asChild`/`Slot` (Radix) usado em ~10 lugares
  do app (`DialogTrigger asChild`, etc.) e os botões só-ícone. Substituído
  por um hover mais sutil e seguro: `transition-all` (era só
  `transition-colors`) + leve elevação (`hover:-translate-y-px`) +
  compressão no clique (`active:scale-[0.98]`), em `components/ui/button.tsx`
  — funciona igual em qualquer variante/uso do componente.
- **Tooltips ricos nos KPIs**: novo `components/ui/tooltip.tsx`, escrito à
  mão (hover/focus + `useState` local, sem `@radix-ui/react-tooltip` —
  mantém a convenção "componentes no padrão shadcn/ui escritos à mão" do
  projeto) — cada card de KPI tem um ícone `Info` que mostra a fórmula de
  cálculo daquele KPI ao passar o mouse.
- **Divisores entre seções**: `border-t border-border pt-6` entre os
  blocos da Visão Geral (KPIs → funil/receita/campanhas → gráficos
  secundários → log de eventos), no lugar de só `gap-6` empilhado.

### UTMs para Meta Ads + CRM avançado ("Sprint C", pós-lançamento)

Terceira rodada: template de UTM pronto pra copiar (pedido isolado da
usuária, fora do roteiro A–F) + Sprint C do documento original (CRM
avançado). D (campanhas com fallback de UTM), E (Meta Business
Intelligence) e F (polish geral) continuam como roteiro em aberto.

- **Botão "UTMs para Meta Ads"** (`utm-template-dialog.tsx`, em
  Configurações → Ofertas): diálogo único e global (não por oferta, já
  que o template `{{...}}` da convenção de UTM é universal — ver seção
  "Convenção de UTM obrigatória" acima) com o texto pronto pra colar em
  Gerenciador de Anúncios → Configurações → Parâmetros de URL.
- **Perfil do visitante continua como página** (não virou drawer/gaveta
  como o pedido original sugeria) — decisão explícita da usuária, pra não
  perder a URL direta e compartilhável de cada visitante.
- **Filtros na lista de visitantes**: `visitors-filters.tsx` adiciona
  Status (visitante/lead/comprador/reembolsado) e período (desde/até) à
  busca já existente, tudo via querystring (mesmo padrão do
  `visitors-search.tsx`). `searchVisitors` (`lib/crm/queries.ts`) ganhou
  os parâmetros correspondentes — **atenção ao filtro de status**: como
  `sale_status` é `NULL` pra quem nunca comprou, um `NOT IN` puro excluiria
  esses visitantes por causa da lógica de três valores do SQL; por isso
  "lead"/"visitante" usam `.or("sale_status.is.null,sale_status.not.in.(...)")`
  em vez de só `.not("sale_status", "in", ...)`.
- **Timeline de eventos com ícone por tipo** (`event-icon.tsx`): mapa
  `event_name` → ícone (`PageView`→olho, `Purchase`→check, `InitiateCheckout`→
  cartão, etc.), com fallback por prefixo (`Scroll*`) e por substring
  (`*click*`, `*video*`, case-insensitive) pra eventos customizados que não
  estão no mapa fixo.
- **Mini timeline horizontal da jornada** (`journey-timeline.tsx`, topo do
  perfil do visitante): deriva os marcos principais (primeiro contato,
  conteúdo, checkout iniciado, venda iniciada/aprovada, reembolso) a partir
  dos mesmos `events`/`sales` já carregados pela página — sem query nova —
  e mostra o intervalo de tempo formatado (`min`/`h`/`dias`) entre cada
  marco consecutivo.
- **Payload de request enviado à Meta, não só a resposta**: `sendMetaEvent`
  (`lib/meta/capi.ts`) agora retorna também o `request` (o evento exato
  montado, com `user_data` já hasheado — nunca o `access_token`, que fica
  só na URL da chamada, nunca no corpo). Nova coluna `events.meta_request`
  (migration `0009`) grava esse payload; `event-timeline.tsx` mostra as
  duas seções lado a lado ("Enviado à Meta" / "Resposta da Meta") no
  evento expandido.
- **`track.js` — três capacidades novas, todas aditivas** (não mudam nada
  do comportamento existente se a página não usar nenhum dos atributos):
  - **Cliques em `data-track="Nome do Evento"`**: qualquer elemento (não só
    `<a>`) com esse atributo dispara `send(nome, { element_tag, element_text })`
    no clique, delegado no mesmo listener que já reescrevia links Hotmart.
  - **Vídeo**: `<video>` nativo dispara `VideoPlay`/`VideoComplete` nos
    eventos `play`/`ended` do elemento (uma vez cada, com
    `data-video-name` opcional pra rotular). Embeds do **YouTube/Vimeo**
    são detectados por hostname e têm a query string do `src` reescrita
    pra habilitar a API deles (`enablejsapi=1&origin=...` no YouTube,
    `api=1` no Vimeo) — depois disso, o script escuta `postMessage` da
    própria plataforma pra saber quando o vídeo começou/terminou.
    **Não foi possível validar esse fluxo de postMessage contra um player
    ao vivo neste ambiente** (sem acesso de rede aos domínios deles); se
    `VideoPlay`/`VideoComplete` não disparar pra um embed específico,
    conferir se o `src` original já tinha algum parâmetro de API
    conflitante antes da reescrita.
  - **Visibilidade de seção**: qualquer elemento com
    `data-track-view="Nome da Seção"` dispara o evento uma única vez
    quando 50% dele entra na viewport (`IntersectionObserver`,
    `threshold: 0.5`), depois se desinscreve.
  - A reescrita de links, o scan de vídeos/embeds e a observação de seções
    agora rodam juntos em `scanNewContent()`, chamado no load inicial e a
    cada mutação do DOM (um único `MutationObserver`, em vez de um
    separado só pra links como antes).

### Aba de Campanhas ("Sprint D", pós-lançamento)

Nova página `/dashboard/campaigns` (item "Campanhas" na sidebar), com
drill-down campanha → conjunto → criativo igual ao da Visão Geral, mas com
período/oferta próprios (reaproveita `PeriodSwitcher`/`OfferSwitcher`
globais), filtro de status, cards de resumo, 2 gráficos e export CSV.

- **Atribuição de venda com fallback em 3 níveis** (`lib/reports/campaigns.ts#resolveCampaignId`),
  resolvendo o problema de `sales.campaign_id` não bater com nenhuma
  campanha real quando o anúncio não segue a convenção de UTM:
  1. **Match exato** — `sales.campaign_id` (extraído do `utm_campaign` pela
     convenção `{{id}}--{{name}}`) contra os `campaign_id` reais vindos do
     `ad_spend` (sincronizado da Meta Insights).
  2. **Mapeamento manual** — tabela `campaign_utm_mappings` (migration
     `0010`), cadastrada em Configurações → Ofertas → botão "Mapear UTMs"
     (`campaign-mapping-dialog.tsx`): usuária cola o `utm_campaign` bruto
     que veio na venda e escolhe a campanha real (dropdown das campanhas
     já sincronizadas nessa oferta).
  3. **Fallback por nome** — normaliza (`lowercase`, remove pontuação) o
     `utm_campaign` bruto e o nome de cada campanha real da mesma oferta;
     casa se um contém o outro.
  Sem nenhum dos três, a venda cai no bucket **"Sem atribuição de
  campanha"** (linha própria, itálica, sem gasto) em vez de virar uma
  campanha-fantasma com gasto zerado (como a atribuição só-exata fazia
  antes). **Atribuição por mapeamento manual/fallback só sobe até o nível
  de campanha** — revenue/vendas não descem pra conjunto/criativo nesses
  dois casos (só no match exato, que também casa `adset_id`/`ad_id`),
  porque não há confiança suficiente pra apontar um criativo específico.
- **Status ativo/pausado é uma heurística, não vem da Meta**: campanha com
  gasto > 0 no período selecionado = "Ativa", senão "Pausada"
  (`lib/reports/campaigns.ts`, campo `status` em `CampaignRow`) — a Meta
  exigiria uma chamada extra à API pra buscar `effective_status` da
  campanha, que não foi implementada nesta rodada.
- **Cards de resumo** (`campaign-summary-cards.tsx`): melhor campanha,
  melhor criativo, pior campanha (candidata a pausar), custo total do
  período, ROAS médio ponderado — todos calculados sobre as mesmas linhas
  já carregadas (`getCampaignSummary`), sem query extra.
- **Gráficos**: `top-creatives-chart.tsx` (barra horizontal, top 5
  criativos com gasto > 0 por ROAS) e `roas-trend-chart.tsx` (linha,
  ROAS por dia = `gross_revenue / ad_spend` da própria view
  `daily_metrics`, sempre por dia — sem seguir a granularidade
  hora/dia/semana/mês do resto do dashboard, já que o pedido original
  era especificamente "por dia").
- **Exportar CSV** (`campaigns-table-section.tsx` + `lib/utils/csv.ts`):
  gerado 100% client-side (sem round-trip ao servidor, os dados já estão
  na página) — `Blob` + link `download`, com BOM UTF-8 pra abrir certo no
  Excel com acentos/`R$`.
- **`CampaignTable` (componente compartilhado com a Visão Geral)** ganhou
  2 props opcionais (`showStatus`, `onExportCsv`) em vez de duplicar o
  componente — a Visão Geral continua usando sem nenhum dos dois.
- **Toggle de colunas** do pedido original ("métricas exibidas") já existia
  como botão "Mais colunas" (Sprint A/B) — reaproveitado como está, sem
  criar um segundo controle de colunas.

### Aba Meta Business Intelligence ("Sprint E", pós-lançamento)

Nova página `/dashboard/meta-intelligence` (item "Meta Intelligence" na
sidebar), com 3 seções independentes. **Seções 1 e 2 exigem uma oferta
específica selecionada** (não funcionam em "todas as ofertas", já que
cada oferta tem sua própria conta de anúncio/conta comercial do
Instagram) — a seção 3 funciona nos dois modos, igual ao resto do CRM.

- **Seção 1 — performance de criativos pagos** (`lib/reports/creative-insights.ts`
  + `creative-performance-table.tsx`): para cada anúncio com gasto no
  período, calcula um **score de maturidade** (`saturado`/`escalável`/
  `neutro`) cruzando frequência atual com a variação de CTR vs. o período
  anterior (`getPreviousPeriodFilters`, já existente da Sprint A) —
  **heurística com limiares fixos e ajustáveis, não vem de nenhum
  benchmark da Meta** (`SATURATION_FREQUENCY_THRESHOLD = 3`,
  `SATURATION_CTR_DROP_PCT = 15%`, `SCALABLE_FREQUENCY_THRESHOLD = 1.5`,
  `SCALABLE_CTR_THRESHOLD = 1.5%`, em `creative-insights.ts`). Cada
  combinação gera uma recomendação automática (Pausar / Escalar
  orçamento / Testar variação). **Thumbnail do criativo**
  (`lib/meta/creative.ts#fetchAdThumbnails`) busca `creative.thumbnail_url`
  via o endpoint multi-ID da Graph API (`GET /?ids=a,b,c`) — **não pôde
  ser validado contra uma conta real neste ambiente**; sem thumbnail (ou
  sem token da Marketing API configurado), mostra um ícone de imagem
  quebrada em vez de tentar renderizar uma URL vazia. Ordenação (ROAS/
  CTR/gasto/saturação) é só client-side, sem nova query.
- **Seção 2 — posts orgânicos do Instagram** (`lib/instagram/api-client.ts`
  + `instagram-posts-section.tsx`): novo par de campos por oferta —
  `offers.instagram_business_account_id` (texto puro, como
  `meta_ad_account_id`) e `offers.instagram_access_token` (criptografado,
  mesmo esquema AES de `meta_capi_token` — migration `0011`). **Sem os
  dois configurados, mostra um card com instruções** em vez de tentar a
  chamada (`NotConfiguredCard`). Busca até 30 posts recentes
  (`GET /{ig-user-id}/media`) e, para cada um, os insights
  (`reach,impressions,saved` via `GET /{media-id}/insights`) — **não pôde
  ser validado contra uma conta real neste ambiente**; a Instagram Graph
  API já depreciou `impressions` para alguns tipos de mídia (Reels) e
  isso não foi confirmado ao vivo — se o insight de um post falhar, ele
  entra na lista com métricas zeradas em vez de derrubar o lote inteiro.
  Taxa de engajamento = `(curtidas + comentários + salvamentos) ÷
  alcance`; badge "💡 Potencial para anunciar" quando acima da média dos
  posts retornados (não de um benchmark de mercado).
- **Seção 3 — jornada de maturidade do lead** (`lib/reports/lead-maturity.ts`
  + `lead-maturity-section.tsx`): classifica cada visitante em Frio (1
  contato) / Morno (2+ dias distintos com `PageView`) / Quente (tem
  `InitiateCheckout` mas não comprou) / Comprador (venda aprovada) /
  Embaixador (comprou e depois teve um `PageView` posterior ao
  `approved_at`) — a partir dos mesmos `events`/`sales`/`visitor_summary`
  já existentes, sem tabela nova. **Não é filtrada por período** (é o
  estado atual da jornada, não uma métrica de um recorte de datas) — só
  por oferta, como o resto do CRM. Donut de distribuição + tabela de
  visitantes "quentes" (até 50, mais recentes primeiro) com link direto
  pro perfil do visitante.
- **Campo de filtro "campanha/conjunto" da seção 1** do pedido original
  **não foi implementado** — a oferta selecionada já reduz bastante o
  escopo, e adicionar um segundo nível de filtro específico dessa tabela
  ficou como refinamento futuro (a ordenação client-side cobre a
  necessidade mais comum, que é achar o pior/melhor criativo rápido).

### Melhorias gerais e polish ("Sprint F", pós-lançamento)

Última rodada do roteiro original — fecha as 6 sprints do documento
"PROMPT SESSÃO 2".

- **Meta de ROAS por oferta** (`offers.roas_target`, migration `0012`,
  default `2`): substitui o limiar fixo de 2x que existia hardcoded em
  `campaign-table.tsx`/`kpi-cards.tsx` — agora vem do formulário da
  oferta e é usado tanto no badge verde/vermelho da tabela de campanhas
  quanto na borda pulsante do KPI de ROAS. Em "todas as ofertas", cai
  pro default `2` (não há uma meta "combinada" sensata entre ofertas
  diferentes).
- **Fuso horário por oferta** (`offers.timezone`, mesma migration, default
  `America/Sao_Paulo`): usado só na quebra de vendas por hora do dia
  (`getHourlyBreakdown`/`getTimeSeries` com granularidade "hora") via
  `Intl.DateTimeFormat` — antes sempre corria na hora do servidor (UTC na
  Vercel). Também só faz sentido com uma oferta específica selecionada;
  em "todas as ofertas" cai pro UTC.
- **URL do webhook Hotmart visível** (`webhook-url-copy.tsx`, ao lado da
  lista de últimos 10 recebidos): mesma convenção do snippet de instalação
  — sem `NEXT_PUBLIC_APP_URL` configurada, mostra aviso em vez de um
  placeholder falso.
- **Checklist de diagnóstico do sistema** (`lib/system-status.ts` +
  `system-status-card.tsx`, topo de Configurações → Ofertas): confere só
  a *presença* de cada env var crítica (nunca o valor), separada em
  "obrigatórias" (Supabase, `SECRETS_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`)
  e "opcionais com fallback" (`HOTMART_HOTTOK`, `CRON_SECRET`, credenciais
  do backfill Hotmart) — badge "Sistema 100% operacional" só considera as
  obrigatórias.
- **Toasts em tempo real** (`components/ui/toast.tsx`, escrito à mão, sem
  lib nova — mesma convenção do `tooltip.tsx`): `ToastProvider` montado
  uma vez no layout do dashboard.
  - **Nova venda aprovada**: `new-sale-toast-listener.tsx` assina
    Realtime em `sales` (migration `0013` adiciona a tabela à publicação
    e liga `replica identity full`, necessário pro payload de `UPDATE`
    trazer o status anterior) — dispara só na transição pra `approved`
    (INSERT já aprovado, ou UPDATE que muda de outro status pra
    `approved`), mesma semântica do disparo de Purchase pro Meta/GA4.
  - **ROAS abaixo da meta**: não é um evento realmente "em tempo real"
    (gasto só muda quando alguém sincroniza com a Meta) — em vez de criar
    um job de fundo dedicado, `campaigns-table-section.tsx` avisa uma vez
    quando os dados da tabela de campanhas carregam, se alguma campanha
    com gasto está abaixo do `roas_target` da oferta.
- **Exportar CSV** também em Visitantes (`visitors-export-button.tsx`,
  exporta só a página atual da lista filtrada — não há uma query de
  "exportar tudo" separada ainda) e no log de eventos ao vivo
  (botão em `live-event-log.tsx`, exporta os até 20 eventos já carregados
  na tela).
- **Exportar PDF da Visão Geral**: `window.print()` + CSS de impressão
  (`print:` do Tailwind) em vez de uma lib de geração de PDF no servidor
  — o usuário escolhe "Salvar como PDF" no diálogo de impressão do
  próprio navegador. Sidebar, header, controles de período/atualizar e a
  pilha de toasts ganham `print:hidden`; os containers com
  `overflow-hidden`/`h-screen` do shell viram `overflow-visible`/`h-auto`
  só na impressão, senão o conteúdo fica cortado na altura da tela.
  `print-color-adjust: exact` global garante que o tema escuro realmente
  imprime (por padrão a maioria dos navegadores descarta fundos escuros).
- **Modo de comparação de período do pedido original** já estava
  satisfeito pela Sprint A (KPIs sempre mostram delta % vs. período
  anterior) — não foi adicionado um toggle "comparar sim/não" separado,
  já que esconder um dado que já está calculado (barato de manter visível)
  seria regressão, não polish.

### Bugs encontrados no uso real (pós-Sprint F)

- **"Vendas iniciadas" contando centenas a mais do que deveria**: causa
  raiz era `lib/hotmart/sync-sales.ts` (backfill de vendas retroativas)
  nunca setar `created_at` explicitamente — o default do banco (`now()`)
  fazia as vendas antigas importadas aparecerem como "iniciadas" no dia em
  que a sincronização rodou, não na data real da compra (descoberto por
  um agrupamento óbvio: centenas de vendas com `created_at` idêntico até
  o minuto, batendo exatamente com os horários em que o backfill foi
  executado). Corrigido com `extractOrderDate` (`lib/hotmart/extract.ts`,
  lê `purchase.order_date`) usado como `created_at` no upsert; os
  registros já existentes foram reparados diretamente no banco a partir
  de `raw_payload.purchase.order_date`.
- **Webhooks Hotmart reais sendo rejeitados silenciosamente**: investigando
  a reclamação de "só aparece um produto em Vendas por produto", achamos
  que ~366 webhooks reais (com produtos/order bumps distintos, corretos)
  estavam chegando desde 23/07 mas sendo rejeitados como `invalid_hottok`
  — ou seja, o problema nunca foi a extração de produto (que funciona
  certo, confirmado inspecionando `webhook_logs.payload` de entregas
  reais com múltiplos `product.id` diferentes por transação/order bump);
  é que a var `HOTMART_HOTTOK` configurada não bate mais com o que a
  Hotmart está enviando, então essas vendas nunca chegam a virar linha em
  `sales`. **Isso não é corrigível por código** — precisa conferir o
  `hottok` atual no painel da Hotmart e atualizar a env var na Vercel.
- **Granularidade do gráfico "Faturamento × gasto × lucro" agora é
  escolhível** (`revenue-granularity-toggle.tsx`, querystring
  `?chart_granularity=`), independente da granularidade automática por
  tamanho do período (`lib/reports/filters.ts#pickGranularity`, que
  continua controlando KPIs/funil). Dia/Semana/Mês continuam somando por
  `daily_metrics`; nova opção **"Dia da semana"** soma tudo por Seg–Dom
  (`getTimeSeries` com `overrideGranularity: "weekday"`) — serve pra achar
  o melhor dia da semana pra vender/anunciar, não só o melhor mês. Semana/
  mês/dia da semana renderizam em barras (comparação lado a lado mais
  legível que linha contínua); dia/hora continuam em linha.
- **Reenvio/reprocessamento de venda pela própria Hotmart gravava a data de
  processamento, não a data real da compra**: mesma causa raiz do bug de
  backfill acima, só que no webhook ao vivo
  (`app/api/webhooks/hotmart/route.ts#handlePurchaseEvent`) — sem setar
  `created_at`/`approved_at` a partir de `purchase.order_date`/
  `approved_date` do payload, um reenvio (diferente do botão "Vendas
  retroativas" daqui do sistema, que é seguro) fazia a venda aparecer como
  se tivesse acontecido na hora do reprocessamento, e disparava o
  `Purchase` pra Meta CAPI/GA4 com `event_time` de agora — distorcendo a
  atribuição por horário/dia na conta de anúncios. Corrigido: usa
  `extractOrderDate`/`extractApprovedDate` (mesmos extratores do backfill)
  tanto pro `created_at`/`approved_at` quanto pro `event_time` enviado à
  Meta. **Recomendação**: pra recuperar vendas antigas, preferir o botão
  "Vendas retroativas" ao reenvio manual pela própria Hotmart — este
  último deve ficar só pra casos pontuais recentes (poucos dias).
- **"Hoje"/"Ontem" e qualquer hora exibida no painel estavam até 3h
  adiantadas**: `lib/reports/filters.ts` calculava início/fim do dia com
  `Date#setHours`, que usa o fuso do processo — em produção (Vercel) isso
  é UTC, não `America/Sao_Paulo`. Mesma causa em vários `toLocaleString`
  espalhados por Server Components (última atividade do visitante,
  timeline, webhooks recentes) sem `timeZone` explícito. Corrigido com
  `lib/utils/timezone.ts` (`startOfDayInTimezone`/`endOfDayInTimezone`/
  `startOfMonthInTimezone`, sem lib externa) usado em `parseReportFilters`
  com o fuso da oferta selecionada (`America/Sao_Paulo` por padrão em
  "todas as ofertas") e `lib/format.ts#formatDateTime/formatDate/formatTime`
  (mesmo default) reaproveitado nos Server Components que antes
  duplicavam a formatação sem fuso.
- **Cards de KPI vazando conteúdo no mobile**: `Card` (componente base)
  não tinha `min-w-0` — um item de grid não encolhe abaixo da largura
  intrínseca do conteúdo por padrão, então "R$ 0,00 ↓100.0%" vazava pra
  fora da borda em vez de quebrar linha no grid de 2 colunas do celular.
  Corrigido com `min-w-0` no `Card` + `flex-wrap` na linha valor/delta +
  padding/fonte menores no mobile (`kpi-cards.tsx`).

## Identidade visual

Tema dark forte, paleta **vermelho/dourado/bordô** (pedido da usuária,
alinhado à identidade do SEDA — trocou o tema azulado original de
lançamento): fundo `#170B0D`, superfícies `#211113`, bordas `#3D2024`,
todos com matiz quente de bordô quase-preto. Dourado `#E3B23C` é o
accent (marca, ROAS, glow, badge de "positivo" — mesmo papel que o verde
neon tinha antes), laranja `#FF9F3D` pros alertas, vermelho `#FF4757`
pra reembolso/prejuízo. Fonte Inter (UI) + JetBrains Mono (todos os
números/KPIs, via classe `.font-mono-nums`). Tokens de cor em
`app/globals.css` (`@theme inline`), usados como `bg-background`,
`text-accent`, `border-border` etc. — a maioria dos gráficos (Recharts)
referencia essas variáveis diretamente (`fill="var(--accent)"`), então um
ajuste de paleta futuro é, na prática, só mexer nos valores de `:root`;
os poucos componentes com cores de categoria hardcoded (`payment-donut.tsx`,
`product-sales-chart.tsx`, `lead-maturity-section.tsx`) foram atualizados
junto pra não destoar.
