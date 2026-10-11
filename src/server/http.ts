import "server-only";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { fieldErrors } from "@/lib/validation/student";
import { logError } from "@/lib/log";
import { readCookie, resolveSession, type SessionAdmin } from "./auth/session";

export class HttpError extends Error {
  constructor(
    public status: number,
    public publicMessage: string,
    public details?: Record<string, unknown>,
  ) {
    super(publicMessage);
  }
}

export const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "VIEWER"];
export const EDITORS: Role[] = ["SUPER_ADMIN", "ADMIN"];
export const SUPER: Role[] = ["SUPER_ADMIN"];

export type Ctx = {
  req: Request;
  admin: SessionAdmin;
  ip: string;
  userAgent: string | null;
};

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
  return (req.headers.get("x-real-ip") ?? "local").slice(0, 64);
}

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** CSRF (SEC-06): state-changing requests must come from our own origin. Cookies are also SameSite=Strict. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>();
  if (process.env.APP_ORIGIN) allowed.add(process.env.APP_ORIGIN);
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    /* ignore */
  }
  const host = req.headers.get("host");
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  return allowed.has(origin);
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.publicMessage, ...err.details }, { status: err.status });
  if (err instanceof z.ZodError) return json({ error: "Validation failed", fields: fieldErrors(err) }, { status: 400 });
  if (err instanceof SyntaxError) return json({ error: "Invalid JSON body" }, { status: 400 });
  logError("api.unhandled", err);
  return json({ error: "Something went wrong. Please try again." }, { status: 500 }); // SEC-08: no stack/SQL/PII
}

type Handler<P> = (ctx: Ctx, params: P) => Promise<Response>;

/**
 * Every API route goes through this (CLAUDE.md §4): session → MFA → role → CSRF.
 * Missing/expired session or MFA not completed → 401 (AUTH-10). Wrong role → 403 (AUTH-11).
 */
export function withAuth<P = Record<string, string>>(roles: Role[], handler: Handler<P>) {
  return async (req: Request, routeCtx?: { params?: Promise<P> }): Promise<Response> => {
    try {
      const session = await resolveSession(readCookie(req.headers.get("cookie")));
      if (!session || !session.mfaPassed) return json({ error: "Not signed in" }, { status: 401 });
      if (!roles.includes(session.admin.role)) return json({ error: "You don't have permission to do that" }, { status: 403 });
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) {
        return json({ error: "Request origin not allowed" }, { status: 403 });
      }
      const params = (routeCtx?.params ? await routeCtx.params : {}) as P;
      return await handler({ req, admin: session.admin, ip: clientIp(req), userAgent: req.headers.get("user-agent") }, params);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  const text = await req.text();
  if (text.length > 2_000_000) throw new HttpError(413, "Request too large");
  return schema.parse(text ? JSON.parse(text) : {});
}
