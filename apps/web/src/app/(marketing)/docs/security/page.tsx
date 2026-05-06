import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return (
    <StubPage
      title="Security"
      description="OWASP Web + LLM Top 10 considered on every PR. Threat models per non-trivial feature. Full-strict CI gates from M1 (semgrep, gosec, gitleaks, osv-scanner, trivy, cosign signing, SBOM CycloneDX)."
      sources={[
        {
          label: "docs/security.md",
          href: "https://github.com/egide/egide/blob/main/docs/security.md",
        },
        {
          label: "docs/threat-models/",
          href: "https://github.com/egide/egide/tree/main/docs/threat-models",
        },
        {
          label: "ADR 014 — Security by design",
          href: "/docs/adr/014-security-by-design",
        },
        {
          label: "ADR 016 — Secure SDLC",
          href: "/docs/adr/016-secure-sdlc",
        },
        {
          label: "SECURITY.md (vulnerability disclosure)",
          href: "https://github.com/egide/egide/blob/main/SECURITY.md",
        },
      ]}
    />
  );
}
