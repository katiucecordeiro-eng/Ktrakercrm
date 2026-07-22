import { z } from "zod";

// Payload solto de propósito: a Hotmart pode incluir/omitir campos entre
// produtos e eventos, e a estrutura exata de tracking (sck/src) varia
// conforme a versão do webhook. Validamos só o essencial e guardamos o
// payload bruto em `webhook_logs` para qualquer ajuste fino depois de ver
// entregas reais.
export const hotmartWebhookSchema = z.object({
  id: z.string().optional(),
  event: z.string().min(1),
  creation_date: z.union([z.number(), z.string()]).optional(),
  version: z.string().optional(),
  hottok: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

export type HotmartWebhookPayload = z.infer<typeof hotmartWebhookSchema>;
