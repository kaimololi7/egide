/**
 * S7 — Pricing transparent.
 *
 * 3 columns side by side. No "Most popular" badge. No "Contact us" on Pro.
 * Annual pricing only.
 *
 * cf. docs/landing-blueprint.md §S7
 */

interface Plan {
  name: string;
  price: string;
  unit?: string;
  license: string;
  bullets: string[];
  cta: { label: string; href: string };
}

const PLANS: Plan[] = [
  {
    name: "Community",
    price: "0 €",
    license: "AGPL-3.0",
    bullets: [
      "1 tenant",
      "All 6 framework packs",
      "Rego compiler (Ansible at M6)",
      "BYOK or local Ollama",
      "Template-only mode (no AI required)",
      "Community Discord support",
    ],
    cta: { label: "Install with Docker Compose →", href: "/docs/install" },
  },
  {
    name: "Professional",
    price: "8 000 €",
    unit: "/ year",
    license: "Commercial · self-hosted or Egide Cloud",
    bullets: [
      "Up to 5 tenants",
      "Advanced compiler targets (Kyverno, CIS, AWS Config — by M10)",
      "Continuous compliance + auditor view",
      "Cloud collectors (Proxmox, AWS, Azure, Scaleway, OVH)",
      "LLM observability (Langfuse)",
      "Email support 48h",
    ],
    cta: { label: "Buy with Stripe →", href: "/buy" },
  },
  {
    name: "Enterprise",
    price: "30 000 — 100 000 €",
    unit: "/ year",
    license: "Commercial · includes air-gapped deployment",
    bullets: [
      "Unlimited tenants",
      "Air-gapped Proxmox VM bundle (Mistral 7B included)",
      "SSO / SAML / OIDC / SCIM (Authentik)",
      "White-label MSSP mode",
      "Signed OSCAL exports + hash chain",
      "24/7 SLA + named CSM",
      "Strategic→executable cascade with directive signature workflow",
    ],
    cta: { label: "Talk to us →", href: "/contact" },
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="mx-auto max-w-[1100px] px-6 py-24">
        <h2 className="text-sm uppercase tracking-[0.12em] text-text-muted mb-8">
          Pricing transparent
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className="bg-bg p-7 flex flex-col"
            >
              <h3 className="font-display text-[22px] tracking-tight">
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-[28px] tracking-tight">
                  {plan.price}
                </span>
                {plan.unit ? (
                  <span className="text-sm text-text-muted">{plan.unit}</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-text-muted">{plan.license}</p>
              <ul className="mt-6 space-y-2 text-sm text-text-secondary flex-1">
                {plan.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-accent flex-shrink-0">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.cta.href}
                className="mt-6 inline-flex items-center justify-center h-10 px-4 border border-border-strong rounded-[6px] text-sm font-medium hover:bg-surface transition-colors"
              >
                {plan.cta.label}
              </a>
            </article>
          ))}
        </div>
        <p className="mt-8 text-xs text-text-muted text-center">
          All editions share one codebase. AGPL-3.0 source code on GitHub.{" "}
          <a
            href="/docs/editions"
            className="text-accent hover:text-accent-hover"
          >
            Compare in detail →
          </a>
        </p>
      </div>
    </section>
  );
}
