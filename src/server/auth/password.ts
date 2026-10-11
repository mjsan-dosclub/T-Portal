import "server-only";
import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to Argon2id (node_modules/@node-rs/argon2/index.d.ts).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

// A real hash of a random string, so unknown-email logins spend the same time (AUTH-15).
let dummy: Promise<string> | null = null;
export async function burnPasswordTime(password: string): Promise<void> {
  dummy ??= hash("dos-dummy-" + Math.random().toString(36), OPTIONS);
  await verifyPassword(await dummy, password);
}

export const PASSWORD_RULE = "At least 12 characters";
export function passwordProblem(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 12) return "Password must be at least 12 characters";
  if (pw.length > 200) return "Password is too long";
  return null;
}
