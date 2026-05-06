/**
 * S1 — Hero section.
 *
 * 50/50 split. Left: copy + CTAs + badges. Right: animated cascade SVG.
 * Below: full-width <TerminalReplay> showing the egide CLI sequence.
 *
 * cf. docs/landing-blueprint.md §S1
 */

import { CascadeSVG } from "./CascadeSVG";
import { InstallCommand } from "./InstallCommand";
import { TerminalReplay, type TerminalLine } from "./TerminalReplay";

const TERMINAL_LINES: TerminalLine[] = [
  {
    kind: "prompt",
    text: "egide pyramid generate --frameworks iso27001,nis2 --input ./docs",
  },
  { kind: "ok", text: "extracted 14 documents (Docling)" },
  { kind: "ok", text: "classified 87 chunks against ISO 27001 + NIS2" },
  { kind: "ok", text: "generated 12 policies, 28 procedures, 14 BPMN, 31 KPIs" },
  { kind: "ok", text: "validated 25 coherence rules (all pass)" },
  { kind: "ok", text: "wrote pyramide.json (sha256:1a2b3c…)" },
  { kind: "output", text: "" },
  {
    kind: "prompt",
    text: "egide compile rego --intent intent_db_backup_required",
  },
  { kind: "ok", text: "compiled to bundles/db_backup.tar.gz" },
  { kind: "ok", text: "ran 6 fixtures via opa test (all pass)" },
  { kind: "ok", text: "signed bundle (Ed25519)" },
  { kind: "output", text: "" },
  { kind: "prompt", text: "kubectl apply -f bundles/db_backup.tar.gz" },
  { kind: "output", text: "opa-bundle/db-backup created" },
];

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1100px] px-6 pt-20 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="font-display text-[3rem] leading-[1.05] tracking-tight">
            From a signed directive
            <br />
            to a Rego rule blocking a
            <br />
            non-compliant Pod.
          </h1>
          <p className="mt-6 text-lg text-text-secondary max-w-xl">
            Open-source GRC that compiles your governance into runnable
            policies. Sovereign EU. Air-gappable. Bring your own LLM, or
            none at all.
          </p>
          <InstallCommand />
          <div className="mt-2 flex items-center gap-4">
            <a
              href="/docs/install"
              className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-text-inverse rounded-[6px] text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Start with Docker Compose →
            </a>
            <a
              href="https://github.com/egide/egide"
              className="inline-flex items-center gap-2 h-10 px-4 border border-border-strong text-text-primary rounded-[6px] text-sm font-medium hover:bg-surface transition-colors"
            >
              View on GitHub →
            </a>
          </div>
          <div className="mt-6 flex items-center gap-3 text-xs text-text-muted">
            <span>AGPL-3.0</span>
            <span>·</span>
            <span>17 ADRs published</span>
            <span>·</span>
            <span>Built by an iTrust security consultant</span>
          </div>
        </div>

        <CascadeSVG />
      </div>

      <div className="mx-auto max-w-[1100px] px-6 pb-20">
        <TerminalReplay
          lines={TERMINAL_LINES}
          ariaLabel="Egide CLI: pyramid generate, compile to Rego, kubectl apply"
        />
      </div>
    </section>
  );
}
