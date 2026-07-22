import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY não definida — necessária para salvar/ler tokens de oferta.",
    );
  }
  const asBase64 = Buffer.from(raw, "base64");
  if (asBase64.length === 32) return asBase64;
  // Aceita também uma string qualquer (não recomendado, mas evita quebrar se
  // alguém colar uma chave em outro formato) — deriva 32 bytes estáveis dela.
  return scryptSync(raw, "ktracker-offer-secrets", 32);
}

// Criptografa um token em texto puro para guardar em `offers`. Formato do
// resultado: "<iv base64>.<authTag base64>.<ciphertext base64>".
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    ".",
  );
}

// Descriptografa; retorna null em qualquer falha (formato inválido, chave
// errada, valor vazio) em vez de lançar — quem chama trata como "não
// configurado", nunca deve derrubar /api/track nem o cron.
export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  const parts = ciphertext.split(".");
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];

  try {
    const key = getKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

// Máscara para exibir no formulário sem expor o token completo.
export function maskSecret(ciphertext: string | null | undefined): string | null {
  const plain = decryptSecret(ciphertext);
  if (!plain) return null;
  return `••••••${plain.slice(-6)}`;
}
