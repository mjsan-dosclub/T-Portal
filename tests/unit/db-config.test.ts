import { afterEach, describe, expect, it } from "vitest";
import { poolConfig } from "@/lib/db-config";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----";
const URL_ = "postgresql://u@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"; // no password: GRD-07

describe("Database connection settings (DEP-1)", () => {
  afterEach(() => {
    delete process.env.DATABASE_CA_CERT;
    delete process.env.VERCEL;
  });

  it("SEC-12 with the Supabase CA, TLS is verified (PEM or base64) and sslmode can't override it; small pool on Vercel", () => {
    process.env.DATABASE_CA_CERT = PEM;
    const a = poolConfig(URL_);
    expect(a.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(a.connectionString).not.toContain("sslmode");
    process.env.DATABASE_CA_CERT = Buffer.from(PEM).toString("base64");
    expect((poolConfig(URL_).ssl as { ca: string }).ca).toBe(PEM);
    process.env.VERCEL = "1";
    expect(poolConfig(URL_).max).toBe(3);
    delete process.env.DATABASE_CA_CERT;
    const local = poolConfig("postgresql://dos@127.0.0.1:54329/dos_dev");
    expect(local.ssl).toBeUndefined();
    expect(local.connectionString).toBe("postgresql://dos@127.0.0.1:54329/dos_dev");
  });
});
