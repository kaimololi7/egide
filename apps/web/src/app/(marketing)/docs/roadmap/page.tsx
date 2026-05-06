import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Roadmap" };

export default function Page() {
  return (
    <StubPage
      title="Roadmap"
      description="Public milestone plan from M1 (foundations) to M13+ (cloud targets, Falco). Signed quarterly. No private roadmap."
      sources={[
        {
          label: "docs/roadmap.md",
          href: "https://github.com/egide/egide/blob/main/docs/roadmap.md",
        },
        {
          label: "STATUS.md (current sprint)",
          href: "https://github.com/egide/egide/blob/main/STATUS.md",
        },
      ]}
    />
  );
}
