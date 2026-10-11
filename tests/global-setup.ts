import { execSync } from "node:child_process";
import pg from "pg";

// Rebuilds the disposable test database from migrations + base seed before every run.
// Refuses to touch anything that isn't a local database named *_test (CLAUDE.md §5).
const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://dos:dos-local-only@127.0.0.1:54329/dos_test";

let embedded: { stop: () => Promise<void> } | null = null;

async function reachable() {
  const c = new pg.Client({ connectionString: URL_ });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

export async function setup() {
  const u = new URL(URL_);
  if (!["localhost", "127.0.0.1"].includes(u.hostname) || !u.pathname.endsWith("_test")) {
    throw new Error("Refusing to reset a database that is not a local *_test database");
  }
  if (!(await reachable())) {
    // CI / fresh machine: start the embedded server ourselves.
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const { existsSync } = await import("node:fs");
    const pgs = new EmbeddedPostgres({ databaseDir: "./.pgdata-test", port: Number(u.port), user: u.username, password: decodeURIComponent(u.password), persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {} });
    if (!existsSync("./.pgdata-test/PG_VERSION")) await pgs.initialise();
    await pgs.start();
    try {
      await pgs.createDatabase(u.pathname.slice(1));
    } catch {
      /* exists */
    }
    embedded = pgs;
  }
  const c = new pg.Client({ connectionString: URL_ });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await c.end();
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: URL_ }, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: URL_ }, stdio: "pipe" });
}

export async function teardown() {
  await embedded?.stop();
}
