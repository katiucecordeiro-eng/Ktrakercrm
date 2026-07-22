import { createHash } from "node:crypto";

// SHA-256 normalizado conforme especificação da Meta (lowercase + trim
// antes de hashear) — usado em email, telefone e external_id.
export function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function normalizePhone(phone: string): string {
  // Meta espera apenas dígitos, com código do país, sem símbolos.
  return phone.replace(/[^\d]/g, "");
}
