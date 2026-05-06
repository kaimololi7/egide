/**
 * S7 — Pricing transparent.
 * Cf. docs/landing-blueprint.md §S7 + docs/editions.md.
 */

const tiers = [
  {
    name: "Community",
    price: "Free, AGPL-3.0",
    summary:
      "Single-tenant. All 6 frameworks (ISO 27001, NIS2, DORA, HDS, CIS, ISO 9001 secondary). BYOK or local LLM. Rego compiler at MVP — Ansible at M6.",
    features: [
      "Self-hosted (Docker Compose, Helm, Proxmox)",
      "10 normative clusters bundled",
      "PydanticAI super-agent + degraded mode",
      "OPA Rego compiler + 5 production controls",
      "OSCAL SSP export",
    ],
    cta: { label: "Read AGPL terms", href: "https://github.com/egide-grc/egide/blob/main/LICENSE" },
  },
  {
    name: "Professional",
    price: "Contact us",
    summary:
      "Multi-tenant. Advanced compiler targets. Continuous compliance loop. Auditor view. Cloud collectors.",
    features: [
      "Kyverno + CIS + AWS Config + Falco compiler targets",
      "Continuous compliance with delta detection",
      "Auditor read-only view + signed evidence trail",
      "Cloud collectors (AWS, Scaleway, OVH, Proxmox)",
      "Email + chat support, business hours",
    ],
    cta: { label: "Pricing matrix", href: "https://github.com/egide-grc/egide/blob/main/docs/editions.md" },
  },
  {
    name: "Enterprise",
    price: "Contact us",
    summary:
      "Air-gapped Proxmox VM bundle, SSO/SAML, white-label MSSP, Ed25519-signed OSCAL exports, full strategic→executable cascade with directive signature workflow.",
    features: [
      "Air-gapped Proxmox VM image (bundled Mistral 7B)",
      "SSO / SAML / SCIM",
      "White-label MSSP for managed-service partners",
      "Directive signature workflow (Ed25519 + audit chain)",
      "SLA, dedicated security contact",
    ],
    cta: { label: "Editions matrix", href: "https://github.com/egide-grc/egide/blob/main/docs/editions.md" },
  },
] as const;

export function Pricing() {
  return (
    <section className="hairline border-x-0 border-t-0" id="pricing">
      <div className="mx-auto max-w-[1100px] px-6 py-20">
        <h2 className="font-medium text-2xl tracking-tight">Pricing, transparent</h2>
        <p className="mt-3 max-w-prose text-[var(--color-text-secondary)] text-sm">
          Open core. Self-host the AGPL build with no time limit and no
          feature gate beyond what is documented in{" "}
          <a
            href="https://github.com/egide-grc/egide/blob/main/docs/editions.md"
            className="underline decoration-[var(--color-text-tertiary)] underline-offset-4 hover:text-[var(--color-accent)]"
          >
            docs/editions.md
          </a>
          .
        </p>
        <div className="mt-10 grid grid-cols-1 gap-px bg-[var(--color-border)] md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="flex flex-col bg-[var(--color-bg)] p-6"
            >
              <h3 className="font-medium text-base">{t.name}</h3>
              <p className="mono mt-1 text-[var(--color-text-tertiary)] text-xs">
                {t.price}
              </p>
              <p className="mt-4 text-[var(--color-text-secondary)] text-sm leading-relaxed">
                {t.summary}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-[var(--color-text-secondary)] text-sm">
                {t.features.map((f) => (
                  <li key={f}>
                    <span className="mono text-[var(--color-text-tertiary)]">
                      ·
                    </span>{" "}
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={t.cta.href}
                className="mono mt-6 text-[var(--color-text-tertiary)] text-xs hover:text-[var(--color-accent)]"
              >
                → {t.cta.label}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
