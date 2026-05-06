/**
 * <CascadeNode> — typed pyramid node for cascade visualizations.
 *
 * Cf. docs/design-system.md §CascadeNode + ADR 017.
 * Tokens-only. Border 1px, radius 6px. Status dot top-right.
 */

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export type CascadeNodeKind =
  | "directive"
  | "policy"
  | "procedure"
  | "bpmn"
  | "kpi"
  | "evidence"
  | "intent";

export type CascadeNodeStatus = "draft" | "review" | "published" | "stale";

export interface CascadeNodeProps {
  kind: CascadeNodeKind;
  title: string;
  id?: string;
  status?: CascadeNodeStatus;
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "default" | "compact";
  className?: string;
  /** Optional icon — caller can pass a Lucide component. */
  icon?: ReactNode;
}

const KIND_LABEL: Record<CascadeNodeKind, string> = {
  directive: "Directive",
  policy: "Policy",
  procedure: "Procedure",
  bpmn: "BPMN",
  kpi: "KPI",
  evidence: "Evidence",
  intent: "Intent",
};

// Unicode glyph fallback when no icon prop is provided. Keeps zero-dep.
const KIND_GLYPH: Record<CascadeNodeKind, string> = {
  directive: "§",
  policy: "¶",
  procedure: "≣",
  bpmn: "⤳",
  kpi: "▤",
  evidence: "✓",
  intent: "⟨⟩",
};

const STATUS_COLOR: Record<CascadeNodeStatus, string> = {
  draft: "var(--egide-color-text-muted)",
  review: "var(--egide-color-warning)",
  published: "var(--egide-color-success)",
  stale: "var(--egide-color-danger)",
};

export function CascadeNode({
  kind,
  title,
  id,
  status,
  selected,
  onClick,
  variant = "default",
  className,
  icon,
}: CascadeNodeProps) {
  const compact = variant === "compact";

  const base: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    gap: compact ? "2px" : "var(--egide-space-1)",
    padding: compact ? "6px 10px" : "var(--egide-space-3) var(--egide-space-4)",
    minWidth: compact ? 140 : 200,
    maxWidth: 280,
    border: `1px solid ${selected ? "var(--egide-color-accent)" : "var(--egide-color-border)"}`,
    borderRadius: "var(--egide-radius)",
    background: selected ? "var(--egide-color-accent-muted)" : "var(--egide-color-surface)",
    fontFamily: "var(--egide-font-ui)",
    color: "var(--egide-color-text-primary)",
    textAlign: "left",
    cursor: onClick ? "pointer" : "default",
    transition: "border-color var(--egide-duration) var(--egide-ease-out), background var(--egide-duration) var(--egide-ease-out)",
  };

  const meta: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--egide-space-1)",
    fontSize: compact ? "10px" : "11px",
    color: "var(--egide-color-text-muted)",
    fontFamily: "var(--egide-font-mono)",
    textTransform: "uppercase",
    letterSpacing: "var(--egide-tracking-wide)",
  };

  const titleStyle: CSSProperties = {
    fontSize: compact ? "12px" : "var(--egide-text-base)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  };

  const inner = (
    <>
      {status && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: STATUS_COLOR[status],
          }}
        />
      )}
      <div style={meta}>
        <span aria-hidden style={{ fontFamily: "var(--egide-font-mono)" }}>
          {icon ?? KIND_GLYPH[kind]}
        </span>
        <span>{KIND_LABEL[kind]}</span>
        {id && <span style={{ opacity: 0.7 }}>· {id}</span>}
      </div>
      <div style={titleStyle}>{title}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={base}>
        {inner}
      </button>
    );
  }
  return (
    <div className={className} style={base}>
      {inner}
    </div>
  );
}
