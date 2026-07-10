import { z } from "zod";

export const offerFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da oferta"),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o slug")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  domain: z.string().trim().optional().or(z.literal("")),
  meta_pixel_id: z.string().trim().optional().or(z.literal("")),
  meta_capi_token_ref: z.string().trim().optional().or(z.literal("")),
  ga4_measurement_id: z.string().trim().optional().or(z.literal("")),
  ga4_api_secret_ref: z.string().trim().optional().or(z.literal("")),
  hotmart_product_ids: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
    ),
  currency: z.string().trim().min(1).default("BRL"),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  active: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type OfferFormValues = z.infer<typeof offerFormSchema>;

export const offerIdSchema = z.string().uuid();
