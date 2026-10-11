import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(name: "APP_ENCRYPTION_KEY" | "RECOVERY_PEPPER"): Buffer {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  const buf = Buffer.from(v, "base64");
  if (buf.length !== 32) throw new Error(`${name} must be 32 bytes (base64)`);
  return buf;
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). Used for TOTP secrets at rest. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("APP_ENCRYPTION_KEY"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Bad ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", key("APP_ENCRYPTION_KEY"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256Hex(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Recovery codes are high-entropy, so a peppered HMAC is sufficient and constant-time comparable. */
export function hashRecoveryCode(code: string): string {
  const canonical = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHmac("sha256", key("RECOVERY_PEPPER")).update(canonical).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function generateRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const bytes = randomBytes(10);
    const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}
