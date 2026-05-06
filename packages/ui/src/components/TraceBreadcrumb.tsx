/**
 * <TraceBreadcrumb> — signature component (cf. docs/design-system.md).
 *
 * Renders the chain "directive → policy → procedure → intent → artifact"
 * so the user always knows which pyramid level they're looking at.
 *
 * Each step is a click-through link to the originating artifact.
 *
 * Tokens-only. ADR 017 compliant.
 */

import type { ReactNode } from "react";

export type TraceLevel =
  | "directive"
  | "policy"
  | "procedure"
  | "intent"
  | "artifact";

export interface TraceStep {
  /** Pyramid layer this step represents. */
  level: TraceLevel;
  /** Stable ID (e.g. "P-014", "ISO 27001 · A.8.13"). Rendered mono. */
  id: string;
  /** Optional href ; if omitted, step is non-interactive. */
  href?: string;
  /** Optional secondary label (version, status). */
  meta?: string;
  /** Mark the current/active step. */
  current?: boolean;
}

export interface TraceBreadcrumbProps {
  steps: TraceStep[];
  /** Optional className for the outer nav. */
  className?: string;
  /** Custom Link component (e.g. next/link). Defaults to <a>. */
  linkAs?: (props: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => ReactNode;
  /** Compact mode hides level labels (icon-only style). */
  compact?: boolean;
}

const LEVEL_LABEL: Record<TraceLevel, string> = {
  directive: "DIR",
  policy: "POL",
  procedure: "PROC",
  intent: "INT",
  artifact: "ART",
};

const LEVEL_TITLE: Record<TraceLevel, string> = {
  directive: "Directive",
  policy: "Policy",
  procedure: "Procedure",
  intent: "Intent",
  artifact: "Artifact",
};

export function TraceBreadcrumb({
  steps,
  className = "",
  linkAs,
  compact = false,
}: TraceBreadcrumbProps) {
  const Link = linkAs ?? DefaultLink;

  return (
    <nav
      aria-label="Pyramid trace"
      className={`flex items-center gap-1.5 flex-wrap text-xs font-mono ${className}`}
    >
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isActive = step.current ?? isLast;

        const inner = (
          <span
            className={`inline-flex items-baseline gap-1.5 px-2 py-1 border rounded-[4px] transition-colors ${
              isActive
                ? "border-accent text-text-primary bg-accent-muted"
                : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
            }`}
            title={LEVEL_TITLE[step.level]}
          >
            {!compact ? (
              <span
                className={
                  isActive ? "text-accent" : "text-text-muted"
                }
              >
                {LEVEL_LABEL[step.level]}
              </span>
            ) : null}
            <span>{step.id}</span>
            {step.meta ? (
              <span className="text-text-muted font-normal">
                · {step.meta}
              </span>
            ) : null}
          </span>
        );

        return (
          <span
            key={`${step.level}-${step.id}-${i}`}
            className="inline-flex items-center gap-1.5"
          >
            {step.href && !isActive ? (
              <Link href={step.href}>{inner}</Link>
            ) : (
              inner
            )}
            {!isLast ? (
              <span aria-hidden className="text-text-muted">
                →
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

function DefaultLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className="no-underline">
      {children}
    </a>
  );
}
