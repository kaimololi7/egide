/**
 * <StubPage> — placeholder for docs/marketing pages not yet written.
 *
 * Honest scaffolding : tells the visitor exactly what's coming, when,
 * and where to look in the meantime. Anti-AI-slop : no fake "Coming
 * soon!" with sparkle emoji. Lists the actual underlying source
 * (ADR ID, repo path) so technical visitors aren't blocked.
 */

import Link from "next/link";

export interface StubPageProps {
  /** H1 title. */
  title: string;
  /** One-paragraph description. */
  description: string;
  /** ETA milestone (e.g. "M5", "Q3 2026"). Optional. */
  eta?: string;
  /** Source-of-truth references (file paths, ADR ids). */
  sources?: Array<{ label: string; href: string }>;
  /** Related links (other docs pages). */
  related?: Array<{ label: string; href: string }>;
}

export function StubPage({
  title,
  description,
  eta,
  sources = [],
  related = [],
}: StubPageProps) {
  return (
    <article className="mx-auto max-w-[760px] px-6 py-16">
      <nav className="text-xs font-mono text-text-muted mb-8">
        <Link href="/" className="hover:text-text-primary transition-colors">
          /
        </Link>
        <span className="mx-1.5">→</span>
        <span className="text-text-secondary">{title.toLowerCase()}</span>
      </nav>

      <header className="border-b border-border pb-8 mb-8">
        <h1 className="font-display text-[40px] leading-tight tracking-tight">
          {title}
        </h1>
        <p className="mt-4 text-lg text-text-secondary">{description}</p>
        {eta ? (
          <div className="mt-5 inline-flex items-center gap-2 px-2.5 py-1 border border-border rounded-[4px] font-mono text-[11px] text-text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Detailed page lands at {eta}
          </div>
        ) : null}
      </header>

      {sources.length > 0 ? (
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-[0.12em] text-text-muted mb-4">
            Source of truth
          </h2>
          <ul className="space-y-2 text-sm">
            {sources.map((s) => (
              <li key={s.href} className="font-mono">
                <a
                  href={s.href}
                  className="text-accent hover:text-accent-hover transition-colors"
                  rel="noopener noreferrer"
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section>
          <h2 className="text-sm uppercase tracking-[0.12em] text-text-muted mb-4">
            Related
          </h2>
          <ul className="space-y-2 text-sm">
            {related.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  → {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-16 pt-6 border-t border-border text-xs text-text-muted">
        Contribute an early draft on{" "}
        <a
          href="https://github.com/egide/egide"
          className="text-accent hover:text-accent-hover transition-colors"
          rel="noopener noreferrer"
          target="_blank"
        >
          github.com/egide/egide
        </a>
      </footer>
    </article>
  );
}
