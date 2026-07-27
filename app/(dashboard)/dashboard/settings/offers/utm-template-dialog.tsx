"use client";

import { useState } from "react";
import { Tags, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Template único de UTM pra todas as ofertas/campanhas — os {{...}} são
// parâmetros dinâmicos do próprio Meta Ads Manager (preenchidos por ele
// automaticamente, por anúncio), não valores fixos. Convenção documentada
// no CLAUDE.md: utm_campaign/utm_medium/utm_content = "{{id}}--{{nome}}",
// necessária pro sistema ligar cada venda à campanha/conjunto/anúncio
// certo em vez de ficar "sem atribuição".
const UTM_TEMPLATE =
  "utm_source={{site_source_name}}&utm_medium={{adset.id}}--{{adset.name}}&utm_campaign={{campaign.id}}--{{campaign.name}}&utm_content={{ad.id}}--{{ad.name}}";

export function UtmTemplateDialog() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(UTM_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Tags /> UTMs para Meta Ads
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parâmetros de URL para Meta Ads</DialogTitle>
          <DialogDescription>
            Copie e cole este texto no campo <strong>Parâmetros de URL</strong> dos
            seus anúncios — é o único jeito do sistema conseguir ligar cada venda à
            campanha/conjunto/anúncio certo (sem isso, a venda ainda conta nos KPIs
            gerais, só não aparece quebrada por campanha).
          </DialogDescription>
        </DialogHeader>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
          <code className="font-mono-nums text-accent">{UTM_TEMPLATE}</code>
        </pre>
        <Button onClick={copy} variant="secondary" size="sm" className="self-start">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Onde colar:</p>
          <p>
            No Gerenciador de Anúncios da Meta, é mais rápido colar uma vez só pra
            todos os anúncios futuros: vá em <strong>Configurações</strong> (ícone de
            engrenagem, no topo) → <strong>Parâmetros de URL</strong>, cole o texto
            acima e salve. Todo anúncio novo criado na conta já sai com esses UTMs
            automaticamente.
          </p>
          <p>
            Pra um anúncio específico já existente: abra o anúncio → aba{" "}
            <strong>Rastreamento</strong> → campo <strong>Parâmetros de URL</strong> →
            cole e salve.
          </p>
          <p>
            Os <code className="font-mono-nums">{"{{"}</code> e{" "}
            <code className="font-mono-nums">{"}}"}</code> não são pra trocar por
            nada — é a própria Meta quem preenche esses valores automaticamente,
            por anúncio, na hora de gerar o clique.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
