import { redirect } from "next/navigation";
import { requireStudentPage } from "@/server/student/session";
import { StudentCard } from "../card";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Create a new password" };

/** PH2-7: shown right after signing in with an admin-issued one-time password. */
export default async function ChangePasswordPage() {
  const me = await requireStudentPage({ allowMustChange: true });
  if (!me.mustChangePassword) redirect("/student/account");
  return (
    <StudentCard title="Create a new password" subtitle="You signed in with a one-time password from DOS Club. Choose your own password to continue.">
      <NewPasswordForm />
    </StudentCard>
  );
}
