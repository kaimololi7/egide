import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://egide.io";
const TITLE = "Egide — sovereign GRC that compiles your governance";
const DESCRIPTION =
  "From a signed directive to a Rego rule blocking a non-compliant Pod. Open-source, sovereign EU, air-gappable. Bring your own LLM, or none at all.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s — Egide",
  },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  applicationName: "Egide",
  authors: [{ name: "Egide" }],
  creator: "Egide",
  publisher: "Egide",
  keywords: [
    "GRC",
    "governance risk compliance",
    "open source",
    "policy as code",
    "OPA",
    "Rego",
    "ISO 27001",
    "NIS2",
    "DORA",
    "sovereign",
    "EU",
    "air-gapped",
    "BYOK LLM",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Egide",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  formatDetection: {
    email: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:text-text-inverse focus:px-3 focus:py-2 focus:rounded-[6px] focus:text-sm"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
