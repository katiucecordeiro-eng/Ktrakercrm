"use client";

import { useState } from "react";
import { Code2, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://SEUDOMINIO";

export function InstallSnippetDialog({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${APP_URL}/track.js" data-offer="${slug}" defer></script>`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Code2 /> Snippet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snippet de instalação</DialogTitle>
          <DialogDescription>
            Cole este código antes do fechamento de{" "}
            <code className="font-mono-nums">{"</body>"}</code> em todas as páginas
            desta oferta. Os links de checkout Hotmart são reescritos
            automaticamente com <code className="font-mono-nums">sck</code> e{" "}
            <code className="font-mono-nums">src</code>.
          </DialogDescription>
        </DialogHeader>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
          <code className="font-mono-nums text-accent">{snippet}</code>
        </pre>
        <Button onClick={copy} variant="secondary" size="sm" className="self-start">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
