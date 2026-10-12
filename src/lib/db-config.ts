import type { PoolConfig } from "pg";

/**
 * pg pool settings shared by the app and CLI scripts (DEP-1).
 * - Serverless (Vercel): keep the pool tiny; Supabase's transaction pooler (port 6543) does the real pooling.
 * - TLS: when DATABASE_CA_CERT holds the Supabase root certificate (PEM, or base64 of the PEM), the server
 *   certificate is verified against it. Without it, TLS follows the connection string (local dev has no TLS).
 */
export function poolConfig(connectionString: string): PoolConfig {
  const caRaw = process.env.DATABASE_CA_CERT?.trim();
  const ca = caRaw ? (caRaw.includes("BEGIN CERTIFICATE") ? caRaw : Buffer.from(caRaw, "base64").toString("utf8")) : undefined;
  return {
    // With a CA we verify ourselves, so drop sslmode from the URL (pg would otherwise override `ssl`).
    connectionString: ca ? stripSslMode(connectionString) : connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
  };
}

function stripSslMode(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return url;
  }
}
