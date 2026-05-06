import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "About" };

export default function Page() {
  return (
    <StubPage
      title="About"
      description="Egide is built by an iTrust security consultant. Sovereign by design. EU-only by default. Anti-Vanta. The MVP persona is technical : sysadmin / DevOps / SRE / operational RSSI."
      sources={[
        {
          label: "ADR 001 — Foundation",
          href: "/docs/adr/001-foundation",
        },
        {
          label: "ADR 013 — MVP persona",
          href: "/docs/adr/013-mvp-persona",
        },
      ]}
    />
  );
}
