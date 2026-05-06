/**
 * S2 — What it actually does.
 *
 * 3 dense cards (Ingest / Compile / Approve). Border 1px hairline,
 * no shadow, no decorative animation.
 *
 * cf. docs/landing-blueprint.md §S2
 */

import { CheckCircle2, Code2, Inbox } from "lucide-react";
import type { ComponentType } from "react";

interface Card {
  Icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  footerLabel: string;
  footerHref: string;
}

const CARDS: Card[] = [
  {
    Icon: Inbox,
    title: "Ingest",
    body: "Drop your existing PDFs, Word, and Markdown. Egide extracts and classifies against ISO 27001, NIS2, DORA, CIS, HDS in 10 minutes. Works without an LLM in template-only mode.",
    footerLabel: "How it works",
    footerHref: "/docs/journeys/j1",
  },
  {
    Icon: Code2,
    title: "Compile",
    body: "Every policy emits a runnable Rego bundle, signed and tested against fixtures. Ansible at M6. Kyverno, CIS, AWS Config, Falco follow.",
    footerLabel: "See the IR spec",
    footerHref: "/docs/specs/intent-ir",
  },
  {
    Icon: CheckCircle2,
    title: "Approve",
    body: "Every production-touching action requires Ed25519 human signature. Audit trail by construction. OSCAL exports in Pro+.",
    footerLabel: "Threat model",
    footerHref: "/docs/threat-models/approval-workflow",
  },
];

export function WhatItDoes() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1100px] px-6 py-24">
        <h2 className="text-sm uppercase tracking-[0.12em] text-text-muted mb-8">
          What it actually does
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {CARDS.map(({ Icon, title, body, footerLabel, footerHref }) => (
            <article
              key={title}
              className="bg-bg p-7 flex flex-col"
            >
              <Icon size={22} className="text-accent" />
              <h3 className="mt-4 font-display text-[22px] tracking-tight">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary flex-1">
                {body}
              </p>
              <a
                href={footerHref}
                className="mt-6 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                → {footerLabel}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
