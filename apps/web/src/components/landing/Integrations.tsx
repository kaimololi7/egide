/**
 * S5 — How it integrates.
 *
 * Top: integrations row (text marks, no logos to avoid
 * trademark + sovereignty issues with logo libraries).
 * Bottom: GitHub Actions code sample with file header chrome.
 *
 * cf. docs/landing-blueprint.md §S5
 */

interface Integration {
  name: string;
  status?: "now" | "m6" | "m7" | "m10" | "m13";
}

const INTEGRATIONS: Integration[] = [
  { name: "git", status: "now" },
  { name: "Kubernetes", status: "now" },
  { name: "OPA", status: "now" },
  { name: "PostgreSQL", status: "now" },
  { name: "NATS", status: "now" },
  { name: "S3 / MinIO", status: "now" },
  { name: "ClickHouse", status: "now" },
  { name: "GitHub Actions", status: "now" },
  { name: "Helm", status: "now" },
  { name: "cosign", status: "now" },
  { name: "Ansible", status: "m6" },
  { name: "CIS Benchmarks", status: "m7" },
  { name: "Kyverno", status: "m10" },
  { name: "Proxmox", status: "m10" },
  { name: "Terraform", status: "m13" },
  { name: "Falco", status: "m13" },
];

const STATUS_LABEL: Record<NonNullable<Integration["status"]>, string> = {
  now: "shipping",
  m6: "M6",
  m7: "M7",
  m10: "M10",
  m13: "M13",
};

const WORKFLOW = `# .github/workflows/grc.yml
name: GRC pipeline
on: [push]
jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: egide/action-compile@v1
        with:
          intent: intent_db_backup_required
          targets: [rego, ansible]
      - uses: egide/action-validate@v1
      - uses: egide/action-bundle-sign@v1
        with:
          key: \${{ secrets.EGIDE_SIGNING_KEY }}
      - uses: egide/action-publish-oci@v1
        with:
          registry: ghcr.io`;

export function Integrations() {
  return (
    <section id="integrations" className="border-b border-border scroll-mt-12">
      <div className="mx-auto max-w-[1100px] px-6 py-24">
        <h2 className="text-sm uppercase tracking-[0.12em] text-text-muted mb-8">
          How it integrates
        </h2>

        {/* ── Integration grid ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-border mb-12">
          {INTEGRATIONS.map((i) => (
            <div
              key={i.name}
              className="bg-bg px-3 py-4 flex flex-col items-center justify-center text-center min-h-[68px]"
            >
              <span className="text-sm text-text-primary font-medium">
                {i.name}
              </span>
              {i.status ? (
                <span
                  className={`mt-1 font-mono text-[10px] tracking-[0.06em] uppercase ${
                    i.status === "now" ? "text-accent" : "text-text-muted"
                  }`}
                >
                  {STATUS_LABEL[i.status]}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {/* ── Workflow code block ─────────────────────────────────── */}
        <div className="border border-border rounded-[6px] bg-surface overflow-hidden">
          <div className="h-8 px-4 border-b border-border bg-surface-raised flex items-center justify-between font-mono text-[11px]">
            <span className="text-text-primary">.github/workflows/grc.yml</span>
            <span className="text-text-muted">CI · ubuntu-latest</span>
          </div>
          <pre className="m-0 p-4 font-mono text-[12.5px] leading-relaxed text-text-secondary overflow-x-auto">
            {WORKFLOW}
          </pre>
        </div>

        <p className="mt-6 text-sm text-text-secondary max-w-[640px]">
          Egide is a CLI first. Every action that runs in your terminal
          also runs in your CI. No vendor lock-in.
        </p>
      </div>
    </section>
  );
}
