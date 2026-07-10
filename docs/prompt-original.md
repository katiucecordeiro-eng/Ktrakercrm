# PROMPT — Sistema Próprio de Tracking, CRM & Dashboard (Multi-Oferta)

> **Como usar:** abra o Claude Code na pasta do projeto (vazia), ative o **plan mode** (`Shift+Tab`) e cole este prompt inteiro. Peça o plano primeiro, revise, e só então autorize a execução. Trabalhe sprint por sprint, com commit ao final de cada etapa.

---

## 1. CONTEXTO E OBJETIVO

Sou infoprodutora e vendo produtos digitais pela **Hotmart**, com tráfego pago via **Meta Ads**. Hoje uso GTM + Stape + UTMify. Quero substituir esse stack por um **sistema próprio de rastreamento server-side + CRM + dashboard em tempo real**, que eu controlo de ponta a ponta.

**O sistema deve:**
1. Rastrear visitantes das minhas páginas de vendas com um **script first-party próprio** (sem depender de GTM).
2. Vincular cada venda ao clique/anúncio de origem através de um **ID único de visitante** (vinculação cross-domain via URL até o checkout da Hotmart).
3. Enviar todos os eventos **server-side para a Meta (Conversions API)** e para o **GA4 (Measurement Protocol)**, com deduplicação por `event_id` e dados pessoais **hasheados (SHA-256)**.
4. Receber **webhooks da Hotmart** (compra aprovada, PIX gerado, boleto, reembolso, chargeback, carrinho abandonado) e centralizar tudo num banco de dados próprio.
5. Puxar **gasto de anúncios da Meta Marketing API** (por campanha, conjunto e anúncio/criativo) para calcular ROAS, CPA e lucro reais.
6. Exibir tudo num **dashboard bonito, robusto e em tempo real**, com filtros dinâmicos.
7. Funcionar como um **mini-CRM**: perfil de cada visitante/lead com histórico completo de eventos e jornada (origem, UTMs, páginas, checkout, compra).

**REQUISITO CENTRAL — MULTI-OFERTA:** hoje tenho 1 página rastreada, mas o sistema deve suportar **3 ou mais páginas/ofertas diferentes desde o início**. Cada oferta tem seu próprio: domínio/URL, Pixel ID da Meta, token CAPI, produto(s) Hotmart e configurações. Toda a arquitetura (banco, APIs, dashboard, filtros) deve ser construída em torno da entidade `offer`. Nada pode ser hardcoded para uma única página. O dashboard deve permitir visão consolidada (todas as ofertas) e visão individual por oferta.

---

## 2. STACK OBRIGATÓRIA

- **Frontend/Backend:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **UI:** shadcn/ui + Recharts (gráficos) + lucide-react (ícones)
- **Banco de dados:** Supabase (Postgres) — usar também **Supabase Realtime** para atualização ao vivo do dashboard
- **Deploy:** Vercel (produção) + GitHub (versionamento)
- **Cron jobs:** Vercel Cron (sincronização diária/horária do gasto da Meta)
- **Autenticação do painel:** Supabase Auth (login por e-mail/senha, single-user por enquanto, mas preparado para multi-usuário)
- **Validação:** Zod em todas as rotas de API

---

## 3. ARQUITETURA GERAL

```
┌─────────────────────┐
│ Páginas de vendas    │  ← snippet track.js (first-party)
│ (3+ ofertas)         │
└────────┬────────────┘
         │ eventos (PageView, ViewContent, AddToCart, InitiateCheckout...)
         ▼
┌─────────────────────┐        ┌──────────────────┐
│ API /api/track       │───────▶│ Meta CAPI         │ (server-side, hasheado, dedup)
│ (Vercel Edge/Node)   │───────▶│ GA4 MP            │
└────────┬────────────┘        └──────────────────┘
         ▼
┌─────────────────────┐
│ Supabase (Postgres)  │ ◀──── /api/webhooks/hotmart (compra, reembolso, abandono...)
│ visitors, events,    │ ◀──── /api/cron/meta-spend (Meta Marketing API: gasto por campanha/criativo)
│ sales, ad_spend...   │
└────────┬────────────┘
         ▼ (Realtime)
┌─────────────────────┐
│ Dashboard Next.js    │  KPIs, funil, gráficos, CRM, jornada do usuário, filtros
└─────────────────────┘
```

### O vinculador único (mecanismo central)
1. Na primeira visita, `track.js` gera um `visitor_id` (UUID v4), salva em cookie first-party (1 ano) + localStorage (redundância).
2. Captura e persiste: UTMs (source, medium, campaign, content, term), `fbclid`, `fbp`, `fbc`, `ga_client_id` (se existir), referrer, landing page, IP (via header no server), user agent, geolocalização aproximada por IP (cidade/estado/país).
3. **Todos os links de checkout Hotmart da página são reescritos automaticamente** pelo script para incluir `?sck={visitor_id}` (e `src={utm_source}` como redundância).
4. O webhook da Hotmart devolve o `sck` → o sistema casa a venda com o visitante → jornada completa reconstruída: anúncio → clique → página → checkout → compra.
5. Se o `sck` não vier (venda orgânica/direta), tentar match secundário por e-mail (leads capturados) e, por último, registrar como "sem atribuição".

---

## 4. SCHEMA DO BANCO (Supabase / Postgres)

Criar migrations SQL versionadas. Tabelas principais:

- **offers** — `id, name, slug, domain, meta_pixel_id, meta_capi_token (referência a env/secret), ga4_measurement_id, ga4_api_secret (secret), hotmart_product_ids[], currency (default BRL), tax_rate (imposto %), created_at, active`
- **visitors** — `id (uuid do vinculador), offer_id, first_seen_at, last_seen_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbp, fbc, ga_client_id, referrer, landing_page, ip, user_agent, city, region, country, device_type`
- **events** — `id, visitor_id, offer_id, event_name (PageView | ViewContent | AddToCart | InitiateCheckout | Purchase | Lead | custom), event_id (uuid p/ dedup), page_url, utm_* (snapshot do momento), meta_status (sent | failed | skipped), meta_response jsonb, ga4_status, created_at` — índices por `offer_id + created_at`, `visitor_id`
- **leads** — `id, visitor_id, offer_id, name, email, phone, source, created_at` (captura via formulário próprio e/ou webhook de abandono da Hotmart)
- **sales** — `id, offer_id, visitor_id (nullable), hotmart_transaction_id (unique), product_id, product_name, status (approved | pending | refunded | chargeback | canceled), payment_method (pix | credit_card | boleto | etc), installments, gross_value, net_value, currency, buyer_email_hash, buyer_name, utm_* (herdado do visitante), campaign_id, adset_id, ad_id (via UTM padronizada), approved_at, refunded_at, created_at, raw_payload jsonb`
- **ad_spend** — `id, offer_id, date, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, impressions, clicks, cpc, cpm, synced_at` — unique por `(date, ad_id)`
- **webhook_logs** — `id, source (hotmart | meta), payload jsonb, status, error, created_at` (auditoria de tudo que chega)

**Convenção de UTM obrigatória** (documentar no README): `utm_campaign={{campaign.id}}--{{campaign.name}}`, `utm_content={{ad.id}}--{{ad.name}}`, `utm_medium={{adset.id}}--{{adset.name}}` — assim o sistema faz o join exato entre venda e gasto por campanha/criativo.

---

## 5. MÓDULOS A CONSTRUIR

### Módulo A — Script de rastreamento (`/public/track.js`)
- Snippet único de instalação: `<script src="https://SEUDOMINIO/track.js" data-offer="slug-da-oferta" defer></script>`
- Leve (<10kb), sem dependências, compatível com todos os navegadores.
- Gera/recupera `visitor_id`, captura UTMs e cookies da Meta, envia eventos via `navigator.sendBeacon` (fallback fetch) para `/api/track`.
- Eventos automáticos: `PageView` (com tempo na página no unload), scroll 50%/90% (opcional), clique em qualquer link de checkout → `InitiateCheckout`.
- API pública no window: `window.trk('AddToCart')` para eventos manuais nos botões.
- Reescrita automática dos links de checkout Hotmart com `sck` + `src`.
- Gera `event_id` (uuid) por evento — **o mesmo event_id deve poder ser usado pelo pixel do navegador para deduplicação**, então expor `window.trk.lastEventId`.

### Módulo B — API de eventos + envio server-side (`/api/track`)
- Valida payload (Zod), resolve a oferta pelo `data-offer`, grava `visitor` (upsert) e `event`.
- **Meta CAPI:** montar payload com `event_name`, `event_id`, `event_time`, `event_source_url`, `action_source: website`, `user_data` com `client_ip_address`, `client_user_agent`, `fbp`, `fbc`, `external_id` (visitor_id hasheado) e, quando houver, `em`/`ph` hasheados SHA-256. Enviar para o pixel da oferta correspondente. Registrar resposta em `meta_response`.
- **GA4 MP:** enviar o mesmo evento com `client_id` (ga_client_id ou visitor_id).
- Suportar `test_event_code` via env var para validar no Gerenciador de Eventos da Meta durante o desenvolvimento.
- Retry com backoff (1 tentativa extra) em falha de rede; nunca bloquear a resposta ao navegador (responder 200 rápido, processar envio em `waitUntil`).

### Módulo C — Webhooks Hotmart (`/api/webhooks/hotmart`)
- Validar o header `hottok` (env var).
- Tratar eventos: `PURCHASE_APPROVED`, `PURCHASE_COMPLETE`, `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `PURCHASE_CANCELED`, `PURCHASE_BILLET_PRINTED`, `PURCHASE_OUT_OF_SHOPPING_CART` (abandono), `PIX gerado`.
- Extrair `sck` → casar com `visitor` → herdar UTMs/campanha/criativo na venda.
- Resolver a **oferta** pelo `product_id` da Hotmart (mapeado em `offers.hotmart_product_ids`).
- Em compra aprovada: gravar `sale` + disparar evento `Purchase` server-side para Meta CAPI (com valor, moeda, e-mail/telefone hasheados do comprador — match quality alto) e GA4.
- Em reembolso/chargeback: atualizar status da venda (o dashboard deve refletir em taxa de reembolso e no lucro).
- Abandono de carrinho: gravar/atualizar `lead` com e-mail e telefone (para remarketing).
- Tudo logado em `webhook_logs`. Endpoint idempotente (mesma transação não duplica).

### Módulo D — Sincronização de gasto Meta (`/api/cron/meta-spend`)
- Vercel Cron a cada 1h (e um backfill manual por range de datas via painel).
- Meta Marketing API (Insights): spend, impressions, clicks por `date + campaign + adset + ad`, por conta de anúncio configurada por oferta.
- Upsert em `ad_spend`. Token de longa duração em env var; criar página de configurações no painel com instruções e teste de conexão.

### Módulo E — Dashboard (o coração visual)
**Página principal (visão geral):**
- Seletor de oferta no topo: **Todas | Oferta 1 | Oferta 2 | Oferta 3...**
- Filtros dinâmicos globais persistentes na URL: **período** (hoje, ontem, 7d, 30d, este mês, mês passado, personalizado com date-range picker), **origem** (utm_source/medium), **campanha**, **criativo**, **público/conjunto**, **método de pagamento**.
- **Cards de KPI (linha superior):** Faturamento bruto, Faturamento líquido, Gasto com anúncios, **ROAS** (destaque visual, card maior com borda neon), **Lucro** (líquido − gasto − imposto configurável por oferta), **CPA**, **Margem de lucro %**, Ticket médio, Nº de vendas, **Taxa de reembolso %**, Vendas reembolsadas (qtd e valor), Checkouts iniciados e custo por checkout.
- **Gráfico de funil completo** (funnel chart): Cliques (Meta API) → Visualizações de página → Adições ao carrinho → Checkouts iniciados → Compras realizadas. Mostrar taxa de conversão % entre cada etapa e a taxa total.
- **Gráfico de linha temporal:** Faturamento × Gasto × Lucro por dia (com granularidade por **hora, dia, semana, mês, ano** conforme o período selecionado).
- **Tabela de campanhas:** campanha → gasto, faturamento, vendas, ROAS, CPA, CTR, lucro. Expansível para conjunto → anúncio/**criativo** (ROAS detalhado por criativo). Ordenável, com badges verde/vermelho por ROAS acima/abaixo de um threshold configurável.
- **Vendas por método de pagamento** (donut: PIX, cartão, boleto) e **vendas por hora do dia** (heatmap ou barras — melhor horário).
- **Mapa/ranking por região** (estado/cidade dos visitantes e compradores).
- **Log de eventos ao vivo** (Supabase Realtime): stream dos últimos eventos com nome, oferta, campanha, horário — como no painel "Log de Eventos".

**Página CRM / Visitantes:**
- Tabela pesquisável de visitantes/leads (e-mail, origem, nº de eventos, status: visitante | lead | comprador | reembolsado).
- **Perfil do usuário** (drawer/página): dados do visitante (local, origem, última página, primeiro acesso, fbp, fbc, ga_client_id, IP, navegador) + **Histórico de eventos** em timeline vertical (PageView, InitiateCheckout, Purchase... com data/hora, UTMs de cada evento e expansível em "detalhes" mostrando o **payload JSON exato enviado à Meta e a resposta**) — exatamente como referência de UX de painéis de tracking server-side.

**Página Configurações:**
- CRUD de ofertas (nome, domínio, pixel, tokens, produtos Hotmart, imposto %).
- Snippet de instalação pronto para copiar por oferta.
- Teste de conexão: Meta CAPI (evento de teste), webhook Hotmart (últimos recebidos), Meta Marketing API.
- Gestão do `test_event_code`.

### Módulo F — API de relatórios
- Endpoints agregados otimizados (SQL com CTEs/views materializadas se necessário) — o dashboard nunca deve calcular métricas pesadas no cliente.
- Criar views SQL: `daily_metrics`, `campaign_performance`, `funnel_by_offer`.

---

## 6. IDENTIDADE VISUAL DO PAINEL

- **Tema dark obrigatório, forte e robusto:** fundo `#0A0E14` / superfícies `#111722`, bordas sutis `#1E2733`.
- **Cor de destaque: verde neon `#22FF88`** para métricas positivas/ROAS (com glow sutil), **âmbar `#FFB020`** para alertas/checkouts, **vermelho `#FF4757`** para reembolsos/prejuízo.
- Tipografia: Inter (UI) + **JetBrains Mono para todos os números/KPIs** (aparência técnica de terminal).
- Cards com cantos levemente arredondados, hover states, micro-animações discretas (contadores animados nos KPIs, transições nos gráficos).
- Densidade de informação alta mas respirável — painel de operação profissional, não site institucional. Referência: dashboards de trading/observabilidade.
- 100% responsivo (uso frequente pelo celular).
- Indicador "● AO VIVO" pulsando quando o Realtime está conectado.

---

## 7. SEGURANÇA & LGPD

- Todos os tokens/secrets em variáveis de ambiente (documentar cada uma no README + `.env.example`).
- Hash SHA-256 de e-mail, telefone e external_id **antes** de qualquer envio à Meta; e-mail do comprador armazenado no banco também hasheado (guardar apenas nome + hash para match).
- Validação de `hottok` no webhook Hotmart; rate limiting básico no `/api/track`; CORS restrito aos domínios das ofertas cadastradas.
- Rotas do dashboard protegidas por Supabase Auth (middleware).
- RLS habilitado no Supabase.

---

## 8. ROADMAP DE SPRINTS (executar nesta ordem, commit por etapa)

1. **Sprint 1 — Fundação:** repo, Next.js + Tailwind + shadcn, Supabase (migrations completas), auth do painel, CRUD de ofertas, deploy inicial na Vercel.
2. **Sprint 2 — Tracking:** `track.js` + `/api/track` + envio Meta CAPI/GA4 com dedup e hashing + vinculador `sck` + validação com test_event_code.
3. **Sprint 3 — Hotmart:** webhooks completos, casamento venda↔visitante, Purchase server-side, leads de abandono, logs.
4. **Sprint 4 — Meta Spend:** Marketing API, cron, backfill, join campanha/criativo via convenção de UTM.
5. **Sprint 5 — Dashboard:** KPIs, funil, gráficos temporais, tabela de campanhas/criativos, filtros dinâmicos, Realtime.
6. **Sprint 6 — CRM & polish:** perfil do usuário com timeline de eventos + payloads, página de configurações, responsivo, ajustes visuais finais.

**Critério de pronto de cada sprint:** funcionando em produção na Vercel, testado com dados reais, commitado com mensagem descritiva.

---

## 9. BOAS PRÁTICAS DE EXECUÇÃO

- Antes de codar: apresente o **plano detalhado** da sprint e aguarde aprovação (plan mode).
- Crie e mantenha um **CLAUDE.md** na raiz com: arquitetura, decisões, convenções (UTM, nomes de eventos), variáveis de ambiente e comandos.
- Commits pequenos e frequentes com mensagens claras (conventional commits).
- Tratamento de erro em toda integração externa (Meta, GA4, Hotmart) — o sistema nunca pode derrubar a página de vendas do cliente; falha de envio vira log, não erro.
- Ao final de cada sprint, gere um checklist de testes manuais para eu validar (ex.: "abra a página X com ?utm_campaign=teste e confira o evento no painel e no Test Events da Meta").

Comece pela Sprint 1: apresente o plano.
