import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncAllOffers } from "@/lib/meta/sync-ad-spend";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Cron injeta "Authorization: Bearer <CRON_SECRET>" automaticamente
// quando a env var CRON_SECRET está definida no projeto. Sem ela, a rota
// fica aberta (conveniente em desenvolvimento local).
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error("[api/cron/meta-spend] Supabase não configurado", error);
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 200 });
  }

  // Resincroniza os últimos 3 dias a cada execução — a Meta às vezes
  // ajusta gasto/impressões com um pequeno atraso.
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 3);

  try {
    const results = await syncAllOffers(supabase, isoDate(since), isoDate(until));
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[api/cron/meta-spend] erro inesperado", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 200 },
    );
  }
}
