/**
 * S4 — Sovereignty without compromise (2x2 grid).
 * Cf. docs/landing-blueprint.md §S4.
 */

const quadrants = [
  {
    title: "Bring your own LLM",
    body: "Anthropic, Mistral La Plateforme, Scaleway AI, OVH AI, OpenAI-compat, or local Ollama / vLLM. Per-task routing. Budget caps. Every call audited with tenant, provider, model, tokens, cost.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/adr/004-multi-llm-router.md",
    cta: "Read ADR 004",
  },
  {
    title: "Or no AI at all",
    body: "Template-only mode generates a usable pyramid from 10 normative clusters without a single LLM call. Air-gapped customers run zero LLM. Demo without an API key.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/adr/004-multi-llm-router.md#degraded-mode",
    cta: "Read §degraded mode",
  },
  {
    title: "Where you choose to run it",
    body: "Docker Compose for evaluation. Helm chart for K8s. Proxmox VM image for air-gapped Enterprise (bundled Mistral 7B). No mandatory cloud dependency.",
    href: "https://github.com/egide-grc/egide#quick-start",
    cta: "Deployment options",
  },
  {
    title: "What you choose to send out",
    body: "privacy_mode: strict blocks all cloud LLM calls. PII scrubber runs pre-prompt for anything cloud-bound. Every external call recorded with full payload metadata.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/adr/014-security-by-design.md",
    cta: "Read ADR 014 §LLM02",
  },
] as const;

export function Sovereignty() {
  return (
    <section className="hairline border-x-0 border-t-0">
      <div className="mx-auto max-w-[1100px] px-6 py-20">
        <h2 className="font-medium text-2xl tracking-tight">
          Sovereignty without compromise
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-px bg-[var(--color-border)] md:grid-cols-2">
          {quadrants.map((q) => (
            <div
              key={q.title}
              className="flex flex-col bg-[var(--color-bg)] p-6"
            >
              <h3 className="font-medium text-[var(--color-text-primary)] text-base">
                {q.title}
              </h3>
              <p className="mt-3 flex-1 text-[var(--color-text-secondary)] text-sm leading-relaxed">
                {q.body}
              </p>
              <a
                href={q.href}
                className="mono mt-5 text-[var(--color-text-tertiary)] text-xs hover:text-[var(--color-accent)]"
              >
                → {q.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
