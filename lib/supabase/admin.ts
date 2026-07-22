import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente com a service role key — ignora RLS. Uso restrito a rotas
// server-only que não têm sessão de usuário: /api/track, webhooks e
// crons. Nunca importar em código que roda no browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
