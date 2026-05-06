/**
 * <AnchorChip> — normative anchor reference rendered as a typed tag.
 *
 * Cf. docs/design-system.md §AnchorChip + ADR 017.
 *
 * Tokens-only. Border 1px, radius 6px, JetBrains Mono 12px.
 * Background = framework color at 12% opacity ; border = 40% ; text = full.
 */

import type { CSSProperties, MouseEventHandler } from "react";

export type AnchorFrameworkId =
  | "iso27001-2022"
  | "iso9001-2026"
  | "nis2"
  | "dora"
  | "cis"
  | "hds";

export type AnchorStatus = "covered" | "partial" | "gap" | "unknown";

export interface AnchorChipProps {
  /** Anchor reference, e.g. "iso27001-2022:A.8.13". */
  ref: string;
  variant?: "default" | "compact" | "outline";
  status?: AnchorStatus;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  ariaLabel?: string;
}

const FRAMEWORK_VAR: Record<AnchorFrameworkId, string> = {
  "iso27001-2022": "var(--egide-color-fw-iso27001)",
  "iso9001-2026": "var(--egide-color-fw-iso9001)",
  nis2: "var(--egide-color-fw-nis2)",
  dora: "var(--egide-color-fw-dora)",
  cis: "var(--egide-color-fw-cis)",
  hds: "var(--egide-color-fw-hds)",
};

const STATUS_COLOR: Record<AnchorStatus, string> = {
  covered: "var(--egide-color-success)",
  partial: "var(--egide-color-warning)",
  gap: "var(--egide-color-danger)",
  unknown: "var(--egide-color-text-muted)",
};

function parseRef(ref: string): { framework: AnchorFrameworkId | null; id: string } {
  const idx = ref.indexOf(":");
  if (idx < 0) return { framework: null, id: ref };
  const fw = ref.slice(0, idx);
  const id = ref.slice(idx + 1);
  if (fw in FRAMEWORK_VAR) return { framework: fw as AnchorFrameworkId, id };
  return { framework: null, id: ref };
}

export function AnchorChip({
  ref,
  variant = "default",
  status,
  onClick,
  className,
  ariaLabel,
}: AnchorChipProps) {
  const { framework, id } = parseRef(ref);
  const fwColor = framework ? FRAMEWORK_VAR[framework] : "var(--egide-color-text-secondary)";

  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--egide-space-1)",
    fontFamily: "var(--egide-font-mono)",
    fontSize: variant === "compact" ? "11px" : "12px",
    lineHeight: 1.2,
    padding: variant === "compact" ? "2px 6px" : "3px 8px",
    borderRadius: "var(--egide-radius)",
    border: `1px solid ${fwColor}`,
    color: fwColor,
    background:
      variant === "outline"
        ? "transparent"
        : `color-mix(in srgb, ${fwColor} 12%, transparent)`,
    cursor: onClick ? "pointer" : "default",
    transition: "background var(--egide-duration) var(--egide-ease-out)",
    whiteSpace: "nowrap",
  };

  const content = (
    <>
      {status && (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: STATUS_COLOR[status],
          }}
        />
      )}
      {framework && (
        <span style={{ opacity: 0.7, fontSize: "0.85em" }}>{framework}</span>
      )}
      <span style={{ fontWeight: 500 }}>{id}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        aria-label={ariaLabel ?? `Open anchor ${ref}`}
        style={base}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={className}
      aria-label={ariaLabel ?? `Anchor ${ref}`}
      style={base}
    >
      {content}
    </span>
  );
}
