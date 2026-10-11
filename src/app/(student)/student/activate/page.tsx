import { redirect } from "next/navigation";
import { studentSignInState } from "@/server/student/session";
import { StudentCard } from "../card";
import { ActivateForm } from "./activate-form";

export const metadata = { title: "First-time access" };

export default async function ActivatePage() {
  if ((await studentSignInState()) === "signed_in") redirect("/student");
  return (
    <StudentCard title="First-time access" subtitle="Enter the email and mobile number DOS Club has for you, choose a password, then set up Google Authenticator on your phone.">
      <ActivateForm />
    </StudentCard>
  );
}
