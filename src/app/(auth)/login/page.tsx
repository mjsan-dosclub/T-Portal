import { redirect } from "next/navigation";
import { currentSignInState } from "@/server/page-auth";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const s = await currentSignInState();
  if (s.state === "signed_in") redirect("/");
  return (
    <AuthCard title="Sign in" subtitle="Step 1 of 2 · Your email and password, then a code from Google Authenticator.">
      <LoginForm />
    </AuthCard>
  );
}
