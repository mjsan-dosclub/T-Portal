// FR-AUTH-8: the first Super Admin is created from the CLI, never through an open endpoint.
// Usage: npm run admin:create -- --email you@yourdomain --name "Your Name" [--role SUPER_ADMIN|ADMIN|VIEWER]
// Prints a one-time password once. Sign in, then enrol Google Authenticator.
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { normalizeEmail } from "../src/lib/normalize";
import { scriptClient } from "../prisma/client-for-scripts";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = normalizeEmail(arg("email"));
  const name = (arg("name") ?? "").trim();
  const role = (arg("role") ?? "SUPER_ADMIN") as "SUPER_ADMIN" | "ADMIN" | "VIEWER";
  if (!email.includes("@") || !name) throw new Error('Usage: npm run admin:create -- --email you@domain --name "Your Name"');
  if (!["SUPER_ADMIN", "ADMIN", "VIEWER"].includes(role)) throw new Error("role must be SUPER_ADMIN, ADMIN or VIEWER");
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? randomBytes(12).toString("base64url");
  if (password.length < 12) throw new Error("ADMIN_INITIAL_PASSWORD must be at least 12 characters");
  const db = scriptClient();
  const exists = await db.adminUser.findUnique({ where: { email } });
  if (exists) throw new Error("An admin with that email already exists");
  const admin = await db.adminUser.create({ data: { email, name, role, passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }) } });
  await db.auditLog.create({ data: { actorId: null, action: "admin.create_cli", entity: "admin_user", entityId: admin.id, after: { role } } });
  await db.$disconnect();
  console.log(`Created ${role}. One-time password (shown once): ${process.env.ADMIN_INITIAL_PASSWORD ? "(from ADMIN_INITIAL_PASSWORD)" : password}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
