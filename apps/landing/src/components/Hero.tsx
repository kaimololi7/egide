/**
 * Hero — S1 of the landing.
 *
 * Copy spec: docs/landing-blueprint.md §S1.
 * Anti-AI-slop: no aurora, no glow, no "AI-powered", no decorative animation.
 */
export function Hero() {
  return (
    <section className="hairline border-x-0 border-t-0">
      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-16 px-6 py-24 md:grid-cols-2">
        <div>
          <h1 className="font-medium text-4xl leading-[1.1] tracking-tight md:text-5xl">
            From a signed directive
            <br />
            to a Rego rule blocking
            <br />
            a non-compliant Pod.
          </h1>
          <p className="mt-6 max-w-prose text-[var(--color-text-secondary)] text-lg">
            Open-source GRC that compiles your governance into runnable
            policies. Sovereign EU. Air-gappable. Bring your own LLM, or none
            at all.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://github.com/egide-grc/egide#quick-start"
              className="hairline rounded-md px-4 py-2 text-sm transition-colors hover:bg-[var(--color-surface)]"
            >
              Start with Docker Compose →
            </a>
            <a
              href="https://github.com/egide-grc/egide"
              className="hairline rounded-md px-4 py-2 text-sm transition-colors hover:bg-[var(--color-surface)]"
            >
              View on GitHub →
            </a>
          </div>
          <p className="mono mt-6 text-[var(--color-text-tertiary)] text-xs">
            AGPL-3.0 · 17 ADRs published · Built by an iTrust security
            consultant
          </p>
        </div>

        <div className="hairline rounded-md p-6">
          <CascadeDiagram />
        </div>
      </div>
    </section>
  );
}

/**
 * Static SVG cascade. No animation per ADR 017 motion budget rule (the
 * blueprint suggests an 8s loop; we ship the static frame in v0 and
 * promote to an SVG SMIL animation later if usability testing confirms
 * the value — kept under the 200ms / no-decorative constraint).
 */
function CascadeDiagram() {
  return (
    <svg
      viewBox="0 0 360 320"
      className="h-auto w-full"
      role="img"
      aria-label="Cascade from a signed directive down to a compiled Rego rule"
    >
      <title>Egide cascade</title>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-[var(--color-text-tertiary)]"
      >
        {/* Directive */}
        <rect x="100" y="20" width="160" height="36" rx="4" />
        <text
          x="180"
          y="42"
          textAnchor="middle"
          className="mono fill-[var(--color-text-primary)]"
          fontSize="11"
        >
          ISO 27001 A.8.13
        </text>

        <line x1="180" y1="56" x2="180" y2="84" />
        {/* Policy */}
        <rect x="100" y="84" width="160" height="36" rx="4" />
        <text
          x="180"
          y="106"
          textAnchor="middle"
          className="mono fill-[var(--color-text-primary)]"
          fontSize="11"
        >
          Policy P-014 · backup
        </text>

        <line x1="180" y1="120" x2="180" y2="148" />
        {/* Intent */}
        <rect x="100" y="148" width="160" height="36" rx="4" />
        <text
          x="180"
          y="170"
          textAnchor="middle"
          className="mono fill-[var(--color-text-primary)]"
          fontSize="11"
        >
          Intent · db_backup_required
        </text>

        {/* Three compiled targets */}
        <line x1="180" y1="184" x2="80" y2="220" />
        <line x1="180" y1="184" x2="180" y2="220" />
        <line x1="180" y1="184" x2="280" y2="220" />

        <rect x="20" y="220" width="120" height="36" rx="4" />
        <text
          x="80"
          y="242"
          textAnchor="middle"
          className="mono fill-[var(--color-text-primary)]"
          fontSize="10"
        >
          policy.rego
        </text>

        <rect x="120" y="220" width="120" height="36" rx="4" />
        <text
          x="180"
          y="242"
          textAnchor="middle"
          className="mono fill-[var(--color-text-secondary)]"
          fontSize="10"
        >
          playbook.yml (M6)
        </text>

        <rect x="220" y="220" width="120" height="36" rx="4" />
        <text
          x="280"
          y="242"
          textAnchor="middle"
          className="mono fill-[var(--color-text-tertiary)]"
          fontSize="10"
        >
          cis-check.sh (M7+)
        </text>

        {/* Result */}
        <rect
          x="20"
          y="276"
          width="120"
          height="28"
          rx="4"
          stroke="var(--color-accent)"
        />
        <text
          x="80"
          y="294"
          textAnchor="middle"
          className="mono fill-[var(--color-accent)]"
          fontSize="9"
        >
          deny: prod-db-3
        </text>
      </g>
    </svg>
  );
}
