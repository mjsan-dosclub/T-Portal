import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSignInState } from "@/server/page-auth";
import { AuthCard } from "../../auth-card";
import { CodeForm } from "../../code-form";

export const metadata = { title: "Two-step verification" };

export default async function TotpPage() {
  const s = await currentSignInState();
  if (s.state === "signed_in") redirect("/");
  if (s.state === "anonymous") redirect("/login");
  if (s.state === "needs_enrol") redirect("/enrol-2fa");
  return (
    <AuthCard title="Two-step verification" subtitle="Step 2 of 2 · Open Google Authenticator and enter the 6-digit code for DOS Club Talent Portal.">
      <CodeForm endpoint="/api/auth/totp" kind="totp" />
      <p className="hint" style={{ marginTop: "1.25rem", textAlign: "center" }}>
        Lost your phone? <Link href="/login/recovery">Use a recovery code</Link>
      </p>
    </AuthCard>
  );
}
