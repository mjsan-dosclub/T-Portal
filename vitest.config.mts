import { randomBytes } from "node:crypto";
import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://dos:dos-local-only@127.0.0.1:54329/dos_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside the React server runtime; tests exercise server code directly.
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // one shared test database
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DB,
      TEST_DATABASE_URL: TEST_DB,
      // Throwaway keys generated per run (never real secrets).
      APP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      RECOVERY_PEPPER: randomBytes(32).toString("base64"),
      APP_ORIGIN: "http://localhost:3000",
    },
  },
});
