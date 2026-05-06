import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Editions" };

export default function Page() {
  return (
    <StubPage
      title="Editions"
      description="Community (AGPL-3.0) ships the entire moat. Professional and Enterprise unlock multi-tenant, SSO/SCIM, dedicated support, and air-gapped Proxmox image with bundled Mistral 7B."
      sources={[
        {
          label: "docs/editions.md",
          href: "https://github.com/egide/egide/blob/main/docs/editions.md",
        },
        {
          label: "ADR 002 — Licensing strategy",
          href: "/docs/adr/002-licensing-strategy",
        },
      ]}
      related={[{ label: "Pricing", href: "/pricing" }]}
    />
  );
}
