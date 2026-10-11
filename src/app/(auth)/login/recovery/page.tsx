import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSignInState } from "@/server/page-auth";
import { AuthCard } from "../../auth-card";
import { CodeForm } from "../../code-form";

export const metadata = { title: "Use a recovery code" };

export default async function RecoveryPage() {
  const s = await currentSignInState();
  if (s.state === "signed_in") redirect("/");
  if (s.state !== "needs_totp") redirect("/login");
  return (
    <AuthCard title="Use a recovery code" subtitle="Each of your 10 recovery codes works once. After signing in, regenerate codes from Account.">
      <CodeForm endpoint="/api/auth/recovery" kind="recovery" />
      <p className="hint" style={{ marginTop: "1.25rem", textAlign: "center" }}>
        <Link href="/login/totp">Back to authenticator code</Link> · No codes left? Ask a Super Admin to reset your 2FA.
      </p>
    </AuthCard>
  );
}
