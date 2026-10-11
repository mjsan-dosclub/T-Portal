import { redirect } from "next/navigation";
import { studentSignInState } from "@/server/student/session";
import { StudentCard } from "../card";
import { StudentLoginForm } from "./login-form";

export const metadata = { title: "Student sign in" };

export default async function StudentLoginPage() {
  if ((await studentSignInState()) === "signed_in") redirect("/student");
  return (
    <StudentCard title="Student sign in" subtitle="Step 1 of 2 · Your email and password, then a code from Google Authenticator.">
      <StudentLoginForm />
    </StudentCard>
  );
}
