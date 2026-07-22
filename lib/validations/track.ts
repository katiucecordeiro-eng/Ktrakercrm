import { z } from "zod";

export const trackEventSchema = z.object({
  offer_slug: z.string().min(1),
  visitor_id: z.string().uuid(),
  event_name: z.string().min(1).max(100),
  event_id: z.string().uuid(),
  page_url: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  landing_page: z.string().nullable().optional(),
  is_new_visitor: z.boolean().optional(),
  device_type: z.string().nullable().optional(),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  utm_content: z.string().nullable().optional(),
  utm_term: z.string().nullable().optional(),
  fbclid: z.string().nullable().optional(),
  fbp: z.string().nullable().optional(),
  fbc: z.string().nullable().optional(),
  ga_client_id: z.string().nullable().optional(),
  custom_data: z
    .object({
      value: z.number().optional(),
      currency: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      content_name: z.string().optional(),
      link_url: z.string().optional(),
      duration_seconds: z.number().optional(),
    })
    .passthrough()
    .optional(),
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;
