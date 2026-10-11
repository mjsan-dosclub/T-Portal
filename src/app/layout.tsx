import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Fonts verified from descienceosclub.com (docs/FACTS.md F2). Body uses the system-UI stack.
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "DOS Club Talent Portal", template: "%s · DOS Club Talent Portal" },
  description: "Admin portal for Descience Open Source Club members",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${spaceGrotesk.variable} ${jetbrains.variable}`}>
      <body>
        <div className="liquid-bg" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {children}
      </body>
    </html>
  );
}
