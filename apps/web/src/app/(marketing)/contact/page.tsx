import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <StubPage
      title="Contact"
      description="Open source : GitHub Issues and Discussions. Commercial : licensing@egide.io (Pro & Enterprise inquiries). Security : see SECURITY.md for responsible disclosure."
      sources={[
        {
          label: "GitHub Issues",
          href: "https://github.com/egide/egide/issues",
        },
        {
          label: "GitHub Discussions",
          href: "https://github.com/egide/egide/discussions",
        },
        {
          label: "SECURITY.md (vulnerability disclosure)",
          href: "https://github.com/egide/egide/blob/main/SECURITY.md",
        },
      ]}
    />
  );
}
