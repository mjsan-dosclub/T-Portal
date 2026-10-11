import Link from "next/link";
import { redirect } from "next/navigation";
import { studentSignInState } from "@/server/student/session";
import { CodeForm } from "../../../(auth)/code-form";
import { StudentCard } from "../card";

export const metadata = { title: "Use a recovery code" };

export default async function StudentRecoveryPage() {
  const s = await studentSignInState();
  if (s === "signed_in") redirect("/student");
  if (s !== "needs_totp") redirect("/student/login");
  return (
    <StudentCard title="Use a recovery code" subtitle="Each of your 10 recovery codes works once. No codes left? Ask your DOS Club coordinator to reset your portal access, then do first-time access again.">
      <CodeForm endpoint="/api/student/auth/recovery" kind="recovery" restartHref="/student/login" />
      <p className="hint" style={{ marginTop: "1.25rem", textAlign: "center" }}><Link href="/student/totp">Back to authenticator code</Link></p>
    </StudentCard>
  );
}
