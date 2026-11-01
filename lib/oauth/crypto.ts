import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Encrypts a refresh token before it is stored (OAuthAccount.encryptedRefreshToken).
 * A refresh token is a standing authorization to send mail as someone — the
 * one credential this whole feature exists to avoid handling in the clear,
 * so it never sits in the database as plain text, unlike an SMTP app
 * password which at least lives only in an environment variable no app
 * code ever writes back to a table.
 *
 * AES-256-GCM: authenticated encryption, so a tampered ciphertext fails to
 * decrypt rather than silently returning garbage that gets used as a token.
 */
const ALGORITHM = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY is required to store or read OAuth refresh tokens.");
  // scrypt rather than using the raw env var as the key: the env var can be
  // any length or shape a human typed, and AES-256 needs exactly 32 bytes.
  return scryptSync(secret, "gladiama-oauth-tokens", 32);
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv : authTag : ciphertext, each base64, so one text column holds it all.
  return [iv, authTag, ciphertext].map((part) => part.toString("base64")).join(":");
}

export function decryptToken(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Malformed encrypted token.");

  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
