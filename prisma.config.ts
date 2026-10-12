import "dotenv/config";
import { defineConfig } from "prisma/config";

// Loads .env (dotenv default). Scripts/tests override DATABASE_URL explicitly.
// Migrations use DIRECT_URL when set: Supabase's transaction pooler (6543) can't run migrations,
// so production migrations go through the session pooler / direct connection (DEP-1).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
