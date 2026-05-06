/**
 * S1.5 — Standards bar.
 *
 * Sober "what we cover" row between Hero and S2. NOT a fake client
 * logo marquee (cf. ADR 017 anti-AI-slop). Lists the normative
 * frameworks Egide knows how to anchor and compile against, with
 * shipping vs roadmap status.
 *
 * cf. docs/landing-blueprint.md (between S1 and S2)
 */

interface Framework {
  name: string;
  scope: string;
  status: "now" | "m6" | "m10" | "m13";
}

const FRAMEWORKS: Framework[] = [
  { name: "ISO 27001:2022", scope: "ISMS · Annex A", status: "now" },
  { name: "NIS2", scope: "Art. 21 · 23", status: "now" },
  { name: "DORA", scope: "ICT risk · TLPT", status: "now" },
  { name: "ITIL 4", scope: "34 practices", status: "now" },
  { name: "ISO 9001:2026", scope: "QMS draft", status: "m6" },
  { name: "HDS", scope: "FR healthcare", status: "m6" },
  { name: "CIS Controls v8", scope: "18 controls", status: "m10" },
  { name: "SOC 2", scope: "TSC mapping", status: "m13" },
];

const STATUS_LABEL: Record<Framework["status"], string> = {
  now: "anchored",
  m6: "M6",
  m10: "M10",
  m13: "M13",
};

export function StandardsBar() {
  return (
    <section
      aria-label="Normative frameworks covered"
      className="border-b border-border bg-surface"
    >
      <div className="mx-auto max-w-[1100px] px-6 py-6">
        <div className="flex items-baseline gap-6 mb-4">
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-text-muted">
            Anchored against
          </span>
          <span className="text-xs text-text-muted">
            Every artifact cites one of these. Hallucination guard
            rejects fabricated anchors.
          </span>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-border">
          {FRAMEWORKS.map((f) => (
            <li
              key={f.name}
              className="bg-surface px-3 py-3 flex flex-col"
            >
              <span className="text-sm text-text-primary font-medium">
                {f.name}
              </span>
              <span className="text-[11px] text-text-muted mt-0.5">
                {f.scope}
              </span>
              <span
                className={`mt-1.5 font-mono text-[10px] tracking-[0.06em] uppercase ${
                  f.status === "now" ? "text-accent" : "text-text-muted"
                }`}
              >
                {STATUS_LABEL[f.status]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
