/**
 * S3 — Show me the code. Real Rego artifact with source comments.
 * Cf. docs/landing-blueprint.md §S3.
 */

const REGO = `package egide.policies.db.backup
# Source: policy_data_protection_v3 / iso27001-2022:A.8.13
# Compiled by Egide v0.1.0 at 2026-05-06T12:00:00Z

deny[msg] {
    input.resource.kind == "PostgresCluster"
    input.resource.metadata.labels["egide.io/criticality"] == "high"
    not input.resource.spec.backup.enabled
    msg := sprintf(
        "Production database %v must have backup enabled (ISO 27001 A.8.13, NIS2 Art.21.2.c)",
        [input.resource.metadata.name],
    )
}`;

export function ShowMeTheCode() {
  return (
    <section className="hairline border-x-0 border-t-0">
      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-12 px-6 py-20 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="font-medium text-2xl tracking-tight">
            Every Rego rule traces back.
          </h2>
          <p className="mt-4 text-[var(--color-text-secondary)] text-sm leading-relaxed">
            Egide compiles a normalized Intent into Rego. Every line carries
            a source comment pointing back to the pyramid artifact and the
            normative anchor it implements. No orphan rules. No hand-editing.
          </p>
          <ul className="mt-6 space-y-2 text-[var(--color-text-secondary)] text-sm">
            <li>
              <span className="mono text-[var(--color-text-tertiary)]">·</span>{" "}
              Source comment links back to{" "}
              <span className="mono">P-014 · backup</span>
            </li>
            <li>
              <span className="mono text-[var(--color-text-tertiary)]">·</span>{" "}
              Anchor cites <span className="mono">iso27001-2022:A.8.13</span>{" "}
              and <span className="mono">nis2:Art.21.2.c</span>
            </li>
            <li>
              <span className="mono text-[var(--color-text-tertiary)]">·</span>{" "}
              Compiler ID + timestamp for reproducibility
            </li>
          </ul>
          <a
            href="https://github.com/egide-grc/egide/blob/main/docs/adr/005-policy-as-code-multi-target.md"
            className="mono mt-8 inline-block text-[var(--color-text-tertiary)] text-xs hover:text-[var(--color-accent)]"
          >
            → See ADR 005 for the full compilation pipeline
          </a>
        </div>
        <pre className="hairline mono overflow-x-auto rounded-md bg-[var(--color-surface)] p-5 text-[13px] leading-relaxed">
          <code>{REGO}</code>
        </pre>
      </div>
    </section>
  );
}
