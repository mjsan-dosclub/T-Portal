import { redirect } from "next/navigation";
import { studentSignInState } from "@/server/student/session";
import { Enrol } from "../../../(auth)/enrol-2fa/enrol";

export const metadata = { title: "Set up Google Authenticator" };

export default async function StudentEnrolPage() {
  const s = await studentSignInState();
  if (s === "anonymous") redirect("/student/login");
  if (s === "needs_totp") redirect("/student/totp");
  return (
    <section className="glass card" style={{ maxWidth: "40rem", margin: "1.5rem auto 0", padding: "2rem" }} aria-labelledby="en-title">
      <h1 id="en-title" style={{ fontSize: "1.55rem", fontWeight: 600 }}>Set up Google Authenticator</h1>
      <p className="hint" style={{ fontSize: "0.92rem", margin: "0.35rem 0 1.25rem" }}>Last step. This keeps your account safe even if someone learns your password.</p>
      <Enrol endpoint="/api/student/auth/enrol" home="/student" restartHref="/student/login" />
    </section>
  );
}
