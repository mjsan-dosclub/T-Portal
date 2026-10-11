import "dotenv/config";
import { defineConfig } from "prisma/config";

// Loads .env (dotenv default). Scripts/tests override DATABASE_URL explicitly.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
