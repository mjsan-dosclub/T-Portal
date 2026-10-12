import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { poolConfig } from "@/lib/db-config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg(poolConfig(connectionString)) });
}

export const db = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = db; // one client per server instance (dev hot reload and warm serverless invocations)
