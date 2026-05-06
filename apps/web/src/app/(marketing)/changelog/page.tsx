import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Changelog" };

export default function Page() {
  return (
    <StubPage
      title="Changelog"
      description="Per-release notes with linked PRs and ADR amendments. Semantic versioning. Signed releases (cosign + Ed25519)."
      eta="M5 — first tagged release v0.5.0"
      sources={[
        {
          label: "GitHub Releases",
          href: "https://github.com/egide/egide/releases",
        },
        {
          label: "STATUS.md (current sprint)",
          href: "https://github.com/egide/egide/blob/main/STATUS.md",
        },
      ]}
    />
  );
}
