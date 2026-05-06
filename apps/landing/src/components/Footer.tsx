/**
 * Footer. Minimal, factual, no third-party tracker.
 */

export function Footer() {
  return (
    <footer className="hairline border-x-0 border-b-0">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 py-12 md:flex-row md:justify-between">
        <div>
          <p className="font-medium">Egide</p>
          <p className="mt-2 max-w-prose text-[var(--color-text-secondary)] text-sm">
            Sovereign GRC platform. Open core under AGPL-3.0. Built in the
            EU.
          </p>
          <p className="mono mt-4 text-[var(--color-text-tertiary)] text-xs">
            v0.1.0 · M5 closing → M6 ramp-up
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3">
          <div>
            <p className="mb-3 font-medium text-[var(--color-text-primary)] text-xs uppercase tracking-widest">
              Product
            </p>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide#quick-start"
                >
                  Quick start
                </a>
              </li>
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide/blob/main/docs/editions.md"
                >
                  Editions
                </a>
              </li>
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide/blob/main/docs/roadmap.md"
                >
                  Roadmap
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-medium text-[var(--color-text-primary)] text-xs uppercase tracking-widest">
              Engineering
            </p>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide/tree/main/docs/adr"
                >
                  ADRs
                </a>
              </li>
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide/tree/main/docs/threat-models"
                >
                  Threat models
                </a>
              </li>
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide/blob/main/SECURITY.md"
                >
                  Security policy
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-medium text-[var(--color-text-primary)] text-xs uppercase tracking-widest">
              Project
            </p>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide/blob/main/CONTRIBUTING.md"
                >
                  Contributing
                </a>
              </li>
              <li>
                <a
                  className="hover:text-[var(--color-accent)]"
                  href="https://github.com/egide-grc/egide/blob/main/LICENSE"
                >
                  License
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
