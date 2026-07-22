import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type WebhookLog = {
  id: string;
  source: string;
  status: string | null;
  error: string | null;
  created_at: string;
};

async function getRecentHotmartLogs(): Promise<WebhookLog[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("webhook_logs")
      .select("id, source, status, error, created_at")
      .eq("source", "hotmart")
      .order("created_at", { ascending: false })
      .limit(10);
    return (data as WebhookLog[]) ?? [];
  } catch {
    return [];
  }
}

function statusVariant(status: string | null): "default" | "destructive" | "secondary" {
  if (status === "processed") return "default";
  if (status === "error" || status === "invalid_hottok" || status === "invalid_payload") return "destructive";
  return "secondary";
}

export async function RecentWebhooks() {
  const logs = await getRecentHotmartLogs();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks Hotmart recentes</CardTitle>
        <CardDescription>
          Últimas 10 notificações recebidas — use para conferir se o webhook está
          chegando e qual o formato real do payload (ver `webhook_logs.payload`).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum webhook recebido ainda.
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0"
            >
              <Badge variant={statusVariant(log.status)}>{log.status ?? "—"}</Badge>
              <span className="truncate px-2 text-xs text-muted-foreground">{log.error ?? ""}</span>
              <span className="shrink-0 font-mono-nums text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
