import { requireStudentPage } from "@/server/student/session";
import { StudentNav } from "../student-nav";
import { StudentAccountForms } from "./account-forms";

export const metadata = { title: "Account" };

export default async function StudentAccountPage() {
  const me = await requireStudentPage();
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <StudentNav name={me.fullName} />
      <section className="glass card">
        <h1 className="page-title">Account</h1>
        <p className="hint">Signed in as {me.email}</p>
      </section>
      <StudentAccountForms />
    </div>
  );
}
