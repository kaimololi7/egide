import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "API reference" };

export default function Page() {
  return (
    <StubPage
      title="API reference"
      description="tRPC v1 — bounded contexts: pyramid / compilation / compliance / audit / governance. OpenAPI 3.1 export at M5 for CLI and integrations."
      eta="M5"
      sources={[
        {
          label: "apps/api/src/contexts/",
          href: "https://github.com/egide/egide/tree/main/apps/api/src/contexts",
        },
      ]}
      related={[
        { label: "Architecture", href: "/docs/architecture" },
        { label: "ADR 015 — API versioning", href: "/docs/adr/015-architectural-principles" },
      ]}
    />
  );
}
