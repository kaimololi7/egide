/**
 * S2 — What it actually does.
 * Cf. docs/landing-blueprint.md §S2.
 */

import { CheckCircle2, Code2, Inbox } from "lucide-react";

const cards = [
  {
    icon: Inbox,
    title: "Ingest",
    body: "Drop your existing PDFs, Word, and Markdown. Egide extracts and classifies against ISO 27001, NIS2, DORA, CIS, HDS in 10 minutes. Works without an LLM in template-only mode.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/journeys/j1.md",
    cta: "How it works",
  },
  {
    icon: Code2,
    title: "Compile",
    body: "Every policy emits a runnable Rego bundle, signed and tested against fixtures. Ansible at M6. Kyverno, CIS, AWS Config, Falco follow.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/specs/intent-ir.md",
    cta: "See the IR spec",
  },
  {
    icon: CheckCircle2,
    title: "Approve",
    body: "Every production-touching action requires Ed25519 human signature. Audit trail by construction. OSCAL exports in Pro+.",
    href: "https://github.com/egide-grc/egide/blob/main/docs/adr/010-approval-workflow.md",
    cta: "Read ADR 010",
  },
] as const;

export function WhatItDoes() {
  return (
    <section className="hairline border-x-0 border-t-0">
      <div className="mx-auto max-w-[1100px] px-6 py-20">
        <h2 className="font-medium text-2xl tracking-tight">
          What it actually does
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-px bg-[var(--color-border)] md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="flex flex-col bg-[var(--color-bg)] p-6"
            >
              <c.icon
                size={20}
                strokeWidth={1.5}
                className="text-[var(--color-accent)]"
                aria-hidden
              />
              <h3 className="mt-4 font-medium text-[var(--color-text-primary)] text-lg">
                {c.title}
              </h3>
              <p className="mt-3 flex-1 text-[var(--color-text-secondary)] text-sm leading-relaxed">
                {c.body}
              </p>
              <a
                href={c.href}
                className="mono mt-6 text-[var(--color-text-tertiary)] text-xs hover:text-[var(--color-accent)]"
              >
                → {c.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
