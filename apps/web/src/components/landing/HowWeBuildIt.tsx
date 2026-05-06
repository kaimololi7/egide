/**
 * S6 — How we build it.
 *
 * Differentiator section: AGPL-3.0 + ADR-driven + security mapped +
 * sovereign tooling. Dark surface, light text, narrative voice.
 *
 * cf. docs/landing-blueprint.md §S6
 */

const PILLARS: Array<{
  number: string;
  title: string;
  body: React.ReactNode;
}> = [
  {
    number: "01",
    title: "Open-source by default.",
    body: (
      <>
        AGPL-3.0 core. DCO sign-off, no CLA. Self-host without a license
        ping. Commercial license only for Pro/Enterprise features —
        documented in{" "}
        <a href="/docs/adr/002" className="text-accent hover:text-accent-hover">
          ADR 002
        </a>
        .
      </>
    ),
  },
  {
    number: "02",
    title: "ADR-driven.",
    body: (
      <>
        17 ADRs publicly tracked. Every architectural decision justified and
        reviewable.{" "}
        <a href="/docs/adr" className="text-accent hover:text-accent-hover">
          Browse all 17 →
        </a>
      </>
    ),
  },
  {
    number: "03",
    title: "Security mapped.",
    body: (
      <>
        OWASP Web Top 10 (2021) and OWASP LLM Top 10 (2025) explicitly
        mapped to controls in{" "}
        <a href="/docs/adr/014" className="text-accent hover:text-accent-hover">
          ADR 014
        </a>
        . Threat models per non-trivial feature in{" "}
        <code className="font-mono text-xs text-text-primary">
          docs/threat-models/
        </code>
        . Full SBOM (CycloneDX) per release. cosign-signed images.
      </>
    ),
  },
  {
    number: "04",
    title: "Sovereign tooling.",
    body: (
      <>
        No US-cloud SaaS in our build chain. NATS over Kafka. PostgreSQL +
        pgvector over Elasticsearch. PydanticAI over LangChain. Self-hosted
        Langfuse for LLM observability (
        <a href="/docs/adr/011" className="text-accent hover:text-accent-hover">
          ADR 011
        </a>
        ).
      </>
    ),
  },
];

export function HowWeBuildIt() {
  return (
    <section className="bg-surface border-b border-border">
      <div className="mx-auto max-w-[1100px] px-6 py-24">
        <h2 className="font-display text-[36px] tracking-tight mb-12">
          How we build Egide
        </h2>
        <ol className="space-y-10 max-w-[760px]">
          {PILLARS.map((pillar) => (
            <li key={pillar.number} className="flex gap-6">
              <span className="font-mono text-xs text-text-muted pt-1 w-8 flex-shrink-0">
                {pillar.number}
              </span>
              <div>
                <h3 className="font-display text-[20px] tracking-tight mb-2">
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {pillar.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
