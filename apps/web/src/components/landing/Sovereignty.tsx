/**
 * S4 — Sovereignty without compromise.
 *
 * 2x2 grid. 1px hairline borders, no shadow. Each quadrant is a
 * factual claim with an ADR/doc footer link.
 *
 * cf. docs/landing-blueprint.md §S4
 */

interface Quadrant {
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  footerLabel: string;
  footerHref: string;
}

const QUADRANTS: Quadrant[] = [
  {
    eyebrow: "01 · LLM",
    title: "Bring your own LLM",
    body: (
      <>
        Anthropic, Mistral La Plateforme, Scaleway AI, OVH AI,
        OpenAI-compatible, or local Ollama / vLLM. Per-task routing.
        Budget caps. Every call audited with tenant, provider, model,
        tokens, cost.
      </>
    ),
    footerLabel: "Read ADR 004",
    footerHref: "/docs/adr/004",
  },
  {
    eyebrow: "02 · LLM",
    title: "Or no AI at all",
    body: (
      <>
        Template-only mode generates a usable pyramid from 10 normative
        clusters without a single LLM call. Air-gapped customers run
        zero LLM. Demo without an API key.
      </>
    ),
    footerLabel: "Read ADR 004 · degraded mode",
    footerHref: "/docs/adr/004#degraded-mode",
  },
  {
    eyebrow: "03 · Hosting",
    title: "Where you choose to run it",
    body: (
      <>
        Docker Compose for evaluation. Helm chart for K8s. Proxmox VM
        image for air-gapped Enterprise (bundled Mistral 7B). No
        mandatory cloud dependency.
      </>
    ),
    footerLabel: "Deployment options",
    footerHref: "/docs/install",
  },
  {
    eyebrow: "04 · Data",
    title: "What you choose to send out",
    body: (
      <>
        <code>privacy_mode: strict</code> blocks all cloud LLM calls.
        PII scrubber runs pre-prompt for anything cloud-bound. Every
        external call recorded with full payload metadata.
      </>
    ),
    footerLabel: "Read ADR 014 · LLM02",
    footerHref: "/docs/adr/014#llm02",
  },
];

export function Sovereignty() {
  return (
    <section id="sovereignty" className="border-b border-border scroll-mt-12">
      <div className="mx-auto max-w-[1100px] px-6 py-24">
        <h2 className="text-sm uppercase tracking-[0.12em] text-text-muted mb-2">
          Sovereignty without compromise
        </h2>
        <p className="text-text-secondary text-base mb-10 max-w-[640px]">
          Four axes you control independently. No bundled assumptions,
          no upsell to "EU mode".
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
          {QUADRANTS.map((q) => (
            <article key={q.title} className="bg-bg p-7 flex flex-col min-h-[220px]">
              <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">
                {q.eyebrow}
              </span>
              <h3 className="mt-2 font-display text-[20px] tracking-tight">
                {q.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary flex-1">
                {q.body}
              </p>
              <a
                href={q.footerHref}
                className="mt-5 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                → {q.footerLabel}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
