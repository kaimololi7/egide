/**
 * S6 — How we build it. The differentiator nobody else publishes.
 * Cf. docs/landing-blueprint.md §S6 + README "How we build it" section.
 */

const items = [
  {
    title: "17 ADRs publicly tracked",
    body: "Every architectural decision justified, dated, reviewable.",
    href: "https://github.com/egide-grc/egide/tree/main/docs/adr",
    cta: "Browse ADRs",
  },
  {
    title: "OWASP Web + LLM Top 10 mapped",
    body: "Each control linked to a code or workflow gate. Not a checkbox exercise.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/adr/014-security-by-design.md",
    cta: "Read ADR 014",
  },
  {
    title: "4 threat models in repo",
    body: "API gateway, LLM router, multi-tenant isolation, more added per non-trivial feature.",
    href: "https://github.com/egide-grc/egide/tree/main/docs/threat-models",
    cta: "See threat models",
  },
  {
    title: "Sovereign tooling end-to-end",
    body: "NATS over Kafka, PostgreSQL + pgvector over Elasticsearch, PydanticAI over LangChain, Scaleway / OVH over Vercel.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/adr/003-stack-decision.md",
    cta: "See the stack ADR",
  },
  {
    title: "Full SBOM per release",
    body: "CycloneDX SBOMs attested with cosign. Reproducible builds. ko-style Go images.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/adr/016-secure-sdlc.md",
    cta: "Read ADR 016",
  },
  {
    title: "AGPL-3.0 core + DCO",
    body: "No CLA. No license ping. Self-host freely. Commercial license for white-label / SLA.",
    href: "https://github.com/egide-grc/egide/blob/main/LICENSE",
    cta: "View LICENSE",
  },
] as const;

export function HowWeBuildIt() {
  return (
    <section className="hairline border-x-0 border-t-0">
      <div className="mx-auto max-w-[1100px] px-6 py-20">
        <h2 className="font-medium text-2xl tracking-tight">
          How we build it
        </h2>
        <p className="mt-3 max-w-prose text-[var(--color-text-secondary)] text-sm">
          The section nobody else does. We publish what we decide, why, and
          what we trade off.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-px bg-[var(--color-border)] md:grid-cols-3">
          {items.map((i) => (
            <div
              key={i.title}
              className="flex flex-col bg-[var(--color-bg)] p-6"
            >
              <h3 className="font-medium text-[var(--color-text-primary)] text-sm">
                {i.title}
              </h3>
              <p className="mt-3 flex-1 text-[var(--color-text-secondary)] text-sm leading-relaxed">
                {i.body}
              </p>
              <a
                href={i.href}
                className="mono mt-5 text-[var(--color-text-tertiary)] text-xs hover:text-[var(--color-accent)]"
              >
                → {i.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
