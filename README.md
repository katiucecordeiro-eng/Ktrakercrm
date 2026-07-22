# KTracker CRM

Sistema próprio de tracking server-side, CRM e dashboard em tempo real,
multi-oferta — substitui GTM + Stape + UTMify para infoprodutos vendidos na
Hotmart com tráfego pago via Meta Ads.

Arquitetura, convenções e roadmap completo estão em [`CLAUDE.md`](./CLAUDE.md).

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha com as credenciais do
   seu projeto Supabase (veja abaixo como criar um).

   ```bash
   cp .env.example .env.local
   ```

3. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000). Sem Supabase
   configurado, o painel abre normalmente (sem exigir login) e mostra um
   aviso amarelo — dados reais e autenticação só funcionam depois do passo 4.

4. Crie um projeto em [supabase.com](https://supabase.com), pegue a Project
   URL, a `anon key` e a `service_role key` em Project Settings → API, e
   preencha no `.env.local`. Depois aplique as migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref <seu-project-ref>
   npx supabase db push
   ```

   (ou cole o conteúdo de cada arquivo em `supabase/migrations/`, em ordem,
   no SQL Editor do painel do Supabase). A migration `0004` habilita o
   Supabase Realtime na tabela `events`, usado pelo log de eventos ao vivo
   do dashboard; a `0005` cria a view usada pela busca em CRM / Visitantes.

5. Crie seu usuário de acesso ao painel em Authentication → Users no painel
   do Supabase (e-mail + senha) — é esse usuário que faz login em `/login`.

## Instalar o tracking numa página de vendas

1. Cadastre a oferta em `/dashboard/settings/offers` (nome, slug, domínio,
   Pixel Meta, GA4).
2. Clique em "Snippet" na linha da oferta, copie o `<script>` e cole antes
   do fechamento de `</body>` na página de vendas.
3. Links de checkout Hotmart na página são reescritos automaticamente com
   `sck`/`src`. Para eventos manuais (ex. clique em "Comprar" customizado),
   use `window.trk('AddToCart', { value: 97, currency: 'BRL' })` no `onclick`.
4. Para validar no Gerenciador de Eventos da Meta, defina
   `META_TEST_EVENT_CODE_<SLUG>` no `.env.local`/Vercel (veja `.env.example`).

## Configurar o webhook da Hotmart

1. Cadastre o(s) ID(s) de produto Hotmart da oferta em
   `/dashboard/settings/offers` (campo "Produtos Hotmart").
2. No painel da Hotmart, em Ferramentas → Webhook, configure a URL
   `https://SEUDOMINIO/api/webhooks/hotmart` e ative os eventos: compra
   aprovada/completa, reembolso, chargeback, cancelamento, boleto emitido
   e carrinho abandonado.
3. Defina `HOTMART_HOTTOK` no `.env.local`/Vercel com o token mostrado na
   configuração do webhook.
4. Todo webhook recebido fica auditado na tabela `webhook_logs`
   (`payload` guarda o corpo bruto) — útil para conferir o formato real
   caso algum campo não seja reconhecido (ver nota em `CLAUDE.md`). As
   últimas 10 entregas aparecem direto na tela de Configurações → Ofertas.

## CRM / Visitantes

Em `/dashboard/visitors`: tabela pesquisável (nome, e-mail, telefone ou
`visitor_id`) de todo mundo que já passou pelo tracking, com status
calculado automaticamente (visitante, lead, comprador ou reembolsado).
Clique numa linha para abrir o perfil completo: dados brutos do
visitante (fbp, fbc, ga_client_id, IP, geo) e uma timeline de eventos —
cada evento expande para mostrar o payload exato enviado à Meta e a
resposta recebida.

> A busca por e-mail só encontra quem já gerou um lead (formulário
> próprio ou carrinho abandonado). Vendas aprovadas guardam só o hash do
> e-mail do comprador (LGPD) — sem lead associado, esse visitante só é
> localizável pelo `visitor_id`.

## Testar as conexões

Na linha de cada oferta em Configurações → Ofertas, o botão
"Diagnóstico" dispara chamadas reais para validar as credenciais: um
evento `PageView` de teste para a Meta Conversions API (aparece no Test
Events se `META_TEST_EVENT_CODE_<OFERTA>` estiver definida) e uma
consulta de 1 dia à Marketing API.

## Sincronizar gasto de anúncios (Meta Marketing API)

1. Gere um token de longa duração da Marketing API (com permissão
   `ads_read` na conta de anúncio) e defina
   `META_MARKETING_API_ACCESS_TOKEN` no `.env.local`/Vercel.
2. Em cada oferta, preencha o campo "Meta Ad Account ID" (com ou sem
   prefixo `act_`).
3. O cron (`/api/cron/meta-spend`, configurado em `vercel.json`)
   resincroniza os últimos 3 dias a cada hora automaticamente na Vercel.
   Para importar um período maior de uma vez, use o botão "Sincronizar
   gasto" na linha da oferta em Configurações.
4. Defina `CRON_SECRET` no `.env.local`/Vercel para proteger o endpoint do
   cron (a Vercel injeta o header de autorização automaticamente).

## Deploy (Vercel)

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Em Settings → Environment Variables, adicione as mesmas variáveis do
   `.env.local` (Production e Preview).
3. Deploy. O cron de gasto (`vercel.json`) é ativado automaticamente — no
   plano Hobby a Vercel executa 1x/dia mesmo com o schedule de 1h.
4. **Troubleshooting**: se a página não carregar depois de um merge/push,
   confira em Deployments se existe um build com o commit mais recente de
   `main` (não um "Redeploy" de um commit antigo — isso reconstrói o
   mesmo código velho, não o atual). Se não aparecer nenhum deployment
   novo após um push em `main`, o Git integration está desconectado —
   revise em Settings → Git.

## Comandos

```bash
npm run dev     # servidor de desenvolvimento
npm run build   # build de produção
npm run start   # servidor de produção (após build)
npm run lint    # eslint
```

## Status do projeto

Ver roadmap de sprints em [`CLAUDE.md`](./CLAUDE.md#roadmap-de-sprints). As
6 sprints do escopo original estão concluídas: fundação, tracking,
Hotmart, Meta Spend, dashboard e CRM & polish. Pontos de atenção para
revisar com dados reais estão documentados no `CLAUDE.md` (o principal é
confirmar o formato exato do payload da Hotmart no primeiro webhook
real).
