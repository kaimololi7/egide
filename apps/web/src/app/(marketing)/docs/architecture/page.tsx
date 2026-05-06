import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Architecture" };

export default function Page() {
  return (
    <StubPage
      title="Architecture"
      description="Three languages, isolated per service: TypeScript (web/api), Go (validator/compiler/pipeline/datalake/agent), Python (extractor/AI workers). Hexagonal selective per ADR 015."
      eta="M5"
      sources={[
        {
          label: "docs/architecture.md",
          href: "https://github.com/egide/egide/blob/main/docs/architecture.md",
        },
        {
          label: "docs/architecture-principles.md",
          href: "https://github.com/egide/egide/blob/main/docs/architecture-principles.md",
        },
        {
          label: "ADR 003 — Stack decision",
          href: "/docs/adr/003-stack-decision",
        },
        {
          label: "ADR 015 — Architectural principles",
          href: "/docs/adr/015-architectural-principles",
        },
      ]}
      related={[
        { label: "ADR index", href: "/docs/adr" },
        { label: "Security", href: "/docs/security" },
      ]}
    />
  );
}
