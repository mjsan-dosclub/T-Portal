import { redirect } from "next/navigation";
import { currentSignInState } from "@/server/page-auth";
import { AuthCard } from "../auth-card";
import { Enrol } from "./enrol";

export const metadata = { title: "Set up Google Authenticator" };

export default async function EnrolPage() {
  const s = await currentSignInState();
  if (s.state === "anonymous") redirect("/login");
  if (s.state === "needs_totp") redirect("/login/totp");
  // signed_in users stay here only while viewing recovery codes; the client handles navigation.
  return (
    <AuthCard title="Set up Google Authenticator" subtitle="Two-step verification is required for every admin account." wide>
      <Enrol />
    </AuthCard>
  );
}
