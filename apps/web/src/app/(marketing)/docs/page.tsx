import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Egide documentation — install, architecture, ADRs, security, API.",
};

interface DocSection {
  title: string;
  description: string;
  links: Array<{ label: string; href: string; status?: "ready" | "stub" }>;
}

const SECTIONS: DocSection[] = [
  {
    title: "Get started",
    description: "Run Egide locally or in your cluster.",
    links: [
      { label: "Install", href: "/docs/install", status: "stub" },
      { label: "Editions", href: "/docs/editions", status: "stub" },
      { label: "Roadmap", href: "/docs/roadmap", status: "stub" },
    ],
  },
  {
    title: "Architecture",
    description: "How the cascade works internally.",
    links: [
      { label: "Overview", href: "/docs/architecture", status: "stub" },
      { label: "ADR index", href: "/docs/adr", status: "stub" },
      { label: "Threat models", href: "/docs/security", status: "stub" },
    ],
  },
  {
    title: "Reference",
    description: "API, CLI, integrations.",
    links: [
      { label: "API reference", href: "/docs/api", status: "stub" },
      { label: "Security", href: "/docs/security", status: "stub" },
    ],
  },
];

export default function DocsIndex() {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-16">
      <header className="border-b border-border pb-8 mb-12">
        <h1 className="font-display text-[40px] leading-tight tracking-tight">
          Documentation
        </h1>
        <p className="mt-3 text-lg text-text-secondary max-w-2xl">
          Egide is open core. Every architectural decision is published as
          an ADR. Every commit is signed. Browse below or read the source
          directly on{" "}
          <a
            href="https://github.com/egide/egide"
            className="text-accent hover:text-accent-hover transition-colors"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          .
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="bg-bg p-6 flex flex-col min-h-[240px]"
          >
            <h2 className="font-display text-lg tracking-tight">
              {section.title}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {section.description}
            </p>
            <ul className="mt-5 space-y-2 text-sm flex-1">
              {section.links.map((link) => (
                <li key={link.href} className="flex items-center gap-2">
                  <Link
                    href={link.href}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    → {link.label}
                  </Link>
                  {link.status === "stub" ? (
                    <span className="font-mono text-[10px] text-text-muted uppercase tracking-[0.06em]">
                      stub
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
