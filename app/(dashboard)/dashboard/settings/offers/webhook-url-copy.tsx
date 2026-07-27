"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

// NEXT_PUBLIC_* é inlined em build time — funciona igual em Server ou
// Client Component. Sem fallback pra placeholder falso (mesma convenção
// do install-snippet-dialog.tsx): sem a env var, avisa em vez de mostrar
// uma URL que parece real mas não funciona.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || null;

export function WebhookUrlCopy() {
  const [copied, setCopied] = useState(false);
  const url = APP_URL ? `${APP_URL}/api/webhooks/hotmart` : null;

  if (!url) {
    return (
      <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
        <strong>NEXT_PUBLIC_APP_URL</strong> não está definida — configure essa variável de
        ambiente na Vercel para ver a URL do webhook aqui.
      </p>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(url!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-2">
      <code className="flex-1 truncate font-mono-nums text-xs text-foreground">{url}</code>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check className="text-accent" /> : <Copy />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}
