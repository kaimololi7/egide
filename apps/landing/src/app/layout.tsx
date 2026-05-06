import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout for the public landing site.
 *
 * Per ADR 017:
 *   - dark mode default (color-scheme dark)
 *   - no third-party tracker (Plausible / Umami can be added when ready)
 *   - no external CDN (fonts self-hosted via @egide/ui)
 *   - security headers shipped at the edge (Scaleway / OVH config), not here
 */

export const metadata: Metadata = {
  metadataBase: new URL("https://egide.eu"),
  title: {
    default: "Egide — sovereign GRC that compiles to Rego",
    template: "%s · Egide",
  },
  description:
    "Open-source GRC that turns directives, policies, and procedures into runnable Rego rules. Sovereign EU. Air-gappable. Bring your own LLM, or none at all.",
  applicationName: "Egide",
  keywords: [
    "GRC",
    "compliance",
    "ISO 27001",
    "NIS2",
    "DORA",
    "OPA Rego",
    "Ansible",
    "open source",
    "AGPL",
    "sovereign",
    "EU",
  ],
  authors: [{ name: "Egide" }],
  creator: "Egide",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://egide.eu",
    siteName: "Egide",
    title: "Egide — sovereign GRC that compiles to Rego",
    description:
      "Open-source GRC that compiles your governance into runnable policies.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body>{children}</body>
    </html>
  );
}
