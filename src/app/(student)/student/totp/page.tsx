import Link from "next/link";
import { redirect } from "next/navigation";
import { studentSignInState } from "@/server/student/session";
import { CodeForm } from "../../../(auth)/code-form";
import { StudentCard } from "../card";

export const metadata = { title: "Two-step verification" };

export default async function StudentTotpPage() {
  const s = await studentSignInState();
  if (s === "signed_in") redirect("/student");
  if (s === "anonymous") redirect("/student/login");
  if (s === "needs_enrol") redirect("/student/enrol");
  return (
    <StudentCard title="Two-step verification" subtitle="Step 2 of 2 · Open Google Authenticator and enter the 6-digit code for DOS Club Talent Portal.">
      <CodeForm endpoint="/api/student/auth/totp" kind="totp" restartHref="/student/login" />
      <p className="hint" style={{ marginTop: "1.25rem", textAlign: "center" }}>
        Lost your phone? <Link href="/student/recovery">Use a recovery code</Link>
      </p>
    </StudentCard>
  );
}
