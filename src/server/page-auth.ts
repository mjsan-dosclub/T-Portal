import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { resolveSession, SESSION_COOKIE, type SessionAdmin } from "./auth/session";

/** For server-rendered pages. Pages only *display*; every mutation is re-authorised in the API (withAuth). */
export async function requirePageAdmin(roles?: Role[]): Promise<SessionAdmin> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = await resolveSession(token);
  if (!s) redirect("/login");
  if (!s.mfaPassed) redirect(s.admin.totpEnabled ? "/login/totp" : "/enrol-2fa");
  if (roles && !roles.includes(s.admin.role)) redirect("/?denied=1");
  return s.admin;
}

/** For the login/enrol pages: who (if anyone) is mid-sign-in. */
export async function currentSignInState() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = await resolveSession(token);
  if (!s) return { state: "anonymous" as const };
  if (s.mfaPassed) return { state: "signed_in" as const };
  return { state: s.admin.totpEnabled ? ("needs_totp" as const) : ("needs_enrol" as const) };
}

export const canEdit = (a: SessionAdmin) => a.role === "SUPER_ADMIN" || a.role === "ADMIN";
export const canExport = (a: SessionAdmin) => canEdit(a) || (a.role === "VIEWER" && a.canExport);
