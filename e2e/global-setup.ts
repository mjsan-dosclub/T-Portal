import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { setup as resetTestDb } from "../tests/global-setup";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://dos:dos-local-only@127.0.0.1:54329/dos_test";

/** Fresh test DB → base seed → small fake dataset → three admins (not yet enrolled) with random passwords. */
export default async function globalSetup() {
  await resetTestDb();
  const env = { ...process.env, DATABASE_URL: TEST_DB };
  execSync("npx tsx prisma/seed.dev.ts 120", { env, stdio: "pipe" });
  mkdirSync("e2e/.auth", { recursive: true });
  const creds: Record<string, { email: string; password: string }> = {};
  for (const role of ["SUPER_ADMIN", "ADMIN", "VIEWER"] as const) {
    const email = `e2e-${role.toLowerCase().replace("_", "-")}@example.test`;
    const password = randomBytes(12).toString("base64url");
    execSync(`npx tsx scripts/create-super-admin.ts --email ${email} --name "E2E ${role}" --role ${role}`, { env: { ...env, ADMIN_INITIAL_PASSWORD: password }, stdio: "pipe" });
    creds[role] = { email, password };
  }
  writeFileSync("e2e/.auth/creds.json", JSON.stringify(creds)); // git-ignored, throwaway test values
}
