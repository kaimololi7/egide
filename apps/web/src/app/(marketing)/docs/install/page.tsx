import type { Metadata } from "next";
import { StubPage } from "@/components/landing/StubPage";

export const metadata: Metadata = { title: "Install" };

export default function Page() {
  return (
    <StubPage
      title="Install"
      description="Three install paths : Docker Compose for evaluation, Helm chart for Kubernetes, Proxmox VM image for air-gapped Enterprise."
      eta="M5"
      sources={[
        {
          label: "deploy/docker/compose.yaml",
          href: "https://github.com/egide/egide/blob/main/deploy/docker/compose.yaml",
        },
        {
          label: "deploy/helm/",
          href: "https://github.com/egide/egide/tree/main/deploy/helm",
        },
      ]}
      related={[
        { label: "Editions", href: "/docs/editions" },
        { label: "Architecture", href: "/docs/architecture" },
      ]}
    />
  );
}
