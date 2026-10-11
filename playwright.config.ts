import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://dos:dos-local-only@127.0.0.1:54329/dos_test";

// E2E runs a production build against the disposable dos_test database.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", viewport: { width: 1280, height: 800 } },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }, dependencies: ["setup"], testIgnore: /auth\.setup\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB,
      APP_ORIGIN: `http://localhost:${PORT}`,
      APP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      RECOVERY_PEPPER: randomBytes(32).toString("base64"),
      NODE_ENV: "production",
    },
  },
});
