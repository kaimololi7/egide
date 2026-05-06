import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Legal & RGPD" };

export default function Page() {
  return (
    <StubPage
      title="Legal & RGPD"
      description="Terms of service, privacy policy, RGPD data processing addendum (DPA), and sub-processors list. Hosted in France. EU-only sub-processors."
      eta="M6"
      sources={[
        {
          label: "Code of Conduct",
          href: "https://github.com/egide/egide/blob/main/CODE_OF_CONDUCT.md",
        },
      ]}
    />
  );
}
