export type EnvCheck = {
  key: string;
  label: string;
  required: boolean;
  present: boolean;
};

// Só verifica presença (nunca expõe o valor) — usado no checklist de
// diagnóstico global em Configurações. "required" reflete o que o
// CLAUDE.md já documenta como obrigatório vs. opcional-com-fallback.
export function getSystemStatus(): { checks: EnvCheck[]; operational: boolean } {
  const checks: EnvCheck[] = [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase URL",
      required: true,
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase anon key",
      required: true,
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase service role key (rotas server-only)",
      required: true,
      present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    {
      key: "SECRETS_ENCRYPTION_KEY",
      label: "Chave de criptografia dos tokens por oferta",
      required: true,
      present: Boolean(process.env.SECRETS_ENCRYPTION_KEY),
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      label: "URL pública do app (snippet, track.js, webhook)",
      required: true,
      present: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    },
    {
      key: "HOTMART_HOTTOK",
      label: "Validação do webhook Hotmart (hottok)",
      required: false,
      present: Boolean(process.env.HOTMART_HOTTOK),
    },
    {
      key: "CRON_SECRET",
      label: "Proteção do cron de sincronização de gasto Meta",
      required: false,
      present: Boolean(process.env.CRON_SECRET),
    },
    {
      key: "HOTMART_CLIENT_ID",
      label: "Backfill de vendas Hotmart — Client ID",
      required: false,
      present: Boolean(process.env.HOTMART_CLIENT_ID),
    },
    {
      key: "HOTMART_CLIENT_SECRET",
      label: "Backfill de vendas Hotmart — Client Secret",
      required: false,
      present: Boolean(process.env.HOTMART_CLIENT_SECRET),
    },
    {
      key: "HOTMART_BASIC_TOKEN",
      label: "Backfill de vendas Hotmart — Basic token",
      required: false,
      present: Boolean(process.env.HOTMART_BASIC_TOKEN),
    },
  ];

  const operational = checks.filter((c) => c.required).every((c) => c.present);
  return { checks, operational };
}
