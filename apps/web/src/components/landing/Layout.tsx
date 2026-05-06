/**
 * Landing layout primitives — Header + Footer.
 *
 * Sticky header per docs/landing-blueprint.md: hide on scroll-down,
 * reveal on scroll-up. Implemented via plain CSS (no JS scroll listener)
 * using position: sticky for now ; smart reveal lands at M5+.
 */

import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto max-w-[1100px] px-6 h-12 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-lg tracking-tight flex items-center gap-2"
        >
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" />
          egide
        </Link>
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-5 text-sm text-text-secondary"
        >
          <a
            href="#code"
            className="hover:text-text-primary transition-colors"
          >
            Code
          </a>
          <a
            href="#sovereignty"
            className="hover:text-text-primary transition-colors"
          >
            Sovereignty
          </a>
          <a
            href="#integrations"
            className="hover:text-text-primary transition-colors"
          >
            Integrations
          </a>
          <a
            href="#pricing"
            className="hover:text-text-primary transition-colors"
          >
            Pricing
          </a>
          <Link
            href="/docs"
            className="hover:text-text-primary transition-colors"
          >
            Docs
          </Link>
          <a
            href="https://github.com/egide/egide"
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
            <span className="font-mono text-[10px] text-text-muted">v0.0.1</span>
          </a>
          <Link
            href="/docs/install"
            className="inline-flex items-center h-8 px-3 bg-accent text-text-inverse rounded-[6px] text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Start →
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function LandingFooter() {
  const columns: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }> = [
    {
      title: "Product",
      links: [
        { label: "Editions", href: "/docs/editions" },
        { label: "Pricing", href: "/pricing" },
        { label: "Changelog", href: "/changelog" },
        { label: "Roadmap", href: "/docs/roadmap" },
      ],
    },
    {
      title: "Documentation",
      links: [
        { label: "Architecture", href: "/docs/architecture" },
        { label: "ADRs", href: "/docs/adr" },
        { label: "Security", href: "/docs/security" },
        { label: "API", href: "/docs/api" },
      ],
    },
    {
      title: "Open source",
      links: [
        { label: "GitHub repo", href: "https://github.com/egide/egide" },
        { label: "Roadmap", href: "/docs/roadmap" },
        { label: "Issues", href: "https://github.com/egide/egide/issues" },
        {
          label: "Discussions",
          href: "https://github.com/egide/egide/discussions",
        },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Legal / RGPD", href: "/legal" },
        { label: "LinkedIn", href: "https://linkedin.com/company/egide-eu" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border mt-24">
      <div className="mx-auto max-w-[1100px] px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-text-primary font-medium mb-3">{col.title}</h4>
            <ul className="space-y-2 text-text-muted">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="hover:text-text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted font-mono">
          <span className="text-text-muted">verify the binary:</span>
          <code className="text-text-secondary select-all">
            cosign verify ghcr.io/egide/api:v0.0.1
          </code>
          <span className="text-border-strong">·</span>
          <a
            href="/pgp.asc"
            className="hover:text-text-primary transition-colors underline decoration-dashed underline-offset-2"
          >
            PGP key (Ed25519)
          </a>
          <span className="text-border-strong">·</span>
          <a
            href="/security.txt"
            className="hover:text-text-primary transition-colors underline decoration-dashed underline-offset-2"
          >
            security.txt
          </a>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-[1100px] px-6 h-14 flex items-center justify-between text-xs text-text-muted">
          <span>© 2026 Egide. Built with sober love in EU.</span>
          <span className="flex items-center gap-3">
            <span>AGPL-3.0</span>
            <span>·</span>
            <span>v0.0.1 — pre-MVP scaffold</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
