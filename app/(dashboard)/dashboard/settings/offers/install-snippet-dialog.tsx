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
            É só esta linha — não precisa adicionar mais nada. Ela já captura
            UTMs, cliques, rolagem, tempo na página e reescreve os links de
            checkout Hotmart (<code className="font-mono-nums">sck</code>/
            <code className="font-mono-nums">src</code>) sozinha.
          </DialogDescription>
        </DialogHeader>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
          <code className="font-mono-nums text-accent">{snippet}</code>
        </pre>
        <Button onClick={copy} variant="secondary" size="sm" className="self-start">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Onde colar:</p>
          <p>
            Precisa entrar antes do fechamento de{" "}
            <code className="font-mono-nums">{"</body>"}</code> (rodapé da
            página) — <strong>não</strong> no <code className="font-mono-nums">{"<head>"}</code>.
            Colar no header não quebra nada, mas o rodapé é mais seguro pra
            não atrasar o carregamento da página.
          </p>
          <p className="font-medium text-foreground">Se seu site é WordPress:</p>
          <p>
            Instale o plugin gratuito <strong>WPCode</strong> (ou &ldquo;Insert
            Headers and Footers&rdquo;) em Plugins → Adicionar novo, ative, vá em
            Configurações → Insert Headers and Footers, cole o snippet no
            campo &ldquo;Scripts no rodapé&rdquo; (footer) e salve. Se usa Elementor Pro,
            também dá pra colar em Elementor → Configurações do Site →
            Código Personalizado, com a localização &ldquo;Antes de {"</body>"}&rdquo;.
          </p>
          <p>
            Depois de colar, teste em Configurações → Ofertas → Diagnóstico
            → &ldquo;Rastreamento&rdquo; (esse teste chama o servidor direto, não
            confirma que o script está na página) — o jeito certo de
            confirmar é abrir a página ao vivo, apertar F12 → aba Network,
            recarregar e procurar uma chamada pra{" "}
            <code className="font-mono-nums">track.js</code> e outra pra{" "}
            <code className="font-mono-nums">/api/track</code>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
