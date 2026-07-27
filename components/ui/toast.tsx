"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "warning";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Toast escrito à mão (sem lib nova) — mesma convenção do tooltip.tsx: um
// Context simples com fila de toasts, cada um se auto-remove depois de
// alguns segundos.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, title: input.title, description: input.description, variant: input.variant ?? "default" }]);
    const duration = input.durationMs ?? 6000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-md border p-3 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2",
              t.variant === "success" && "border-accent/30 bg-card",
              t.variant === "warning" && "border-warning/30 bg-card",
              t.variant === "default" && "border-border bg-card",
            )}
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
            ) : t.variant === "warning" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
