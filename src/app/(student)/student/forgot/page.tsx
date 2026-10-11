import Link from "next/link";
import { StudentCard } from "../card";

export const metadata = { title: "Forgot password" };

/** PH2-5/7: no email service, so only an admin can reset a student's password. */
export default function ForgotPage() {
  return (
    <StudentCard title="Forgot your password?" subtitle="For your security, only a DOS Club admin can reset it.">
      <ol style={{ display: "grid", gap: "0.6rem", paddingLeft: "1.2rem", lineHeight: 1.55 }}>
        <li>Contact your <strong>DOS Club coordinator</strong> with your student code (e.g. DOS-2026-00042) and registered email.</li>
        <li>They&apos;ll give you a <strong>one-time password</strong>, valid for 72 hours.</li>
        <li>
          <Link href="/student/login">Sign in</Link> with your email and that one-time password, then enter your Google Authenticator code.
        </li>
        <li>You&apos;ll be asked to <strong>create a new password</strong> straight away.</li>
      </ol>
      <div className="banner" style={{ marginTop: "1rem" }}>
        Lost your phone too? Use one of your recovery codes, or ask the coordinator to reset your portal access. You&apos;ll then do first-time access again.
      </div>
      <p className="hint" style={{ marginTop: "1.25rem", textAlign: "center" }}>
        <Link href="/student/login">Back to sign in</Link>
      </p>
    </StudentCard>
  );
}
