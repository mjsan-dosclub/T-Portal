import "server-only";

export function portalUrl(path = "") {
  return `${(process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

/** Ready-to-paste WhatsApp / announcement text (no personal data). PH2-5: no email service, so this is the invitation. */
export function invitationMessage() {
  return `📢 DOS Club Talent Portal is live for members!\n\n1️⃣ Open ${portalUrl("/student/activate")}\n2️⃣ Enter the email and mobile number you registered with DOS Club\n3️⃣ Create your password\n4️⃣ Set up Google Authenticator on your phone\n\nHow it works: ${portalUrl("/how-it-works")}\nNever share your password or authenticator codes with anyone. Forgot your password? Ask your DOS Club coordinator.`;
}
