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

   (ou cole o conteúdo de `supabase/migrations/0001_init.sql` no SQL Editor
   do painel do Supabase).

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

## Deploy (Vercel)

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Em Settings → Environment Variables, adicione as mesmas variáveis do
   `.env.local` (Production e Preview).
3. Deploy. As rotas de cron (Sprint 4) serão configuradas em `vercel.json`
   quando o sync de gasto da Meta for implementado.

## Comandos

```bash
npm run dev     # servidor de desenvolvimento
npm run build   # build de produção
npm run start   # servidor de produção (após build)
npm run lint    # eslint
```

## Status do projeto

Ver roadmap de sprints em [`CLAUDE.md`](./CLAUDE.md#roadmap-de-sprints).
Sprints 1 (fundação) e 2 (tracking) concluídas — as demais seguem sprint a
sprint.
