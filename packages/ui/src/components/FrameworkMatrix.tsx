/**
 * <FrameworkMatrix> — heatmap of framework × control coverage.
 *
 * Cf. docs/design-system.md §FrameworkMatrix.
 * Cell color: success/warning/danger/muted by status.
 */

import type { CSSProperties } from "react";

export type FrameworkMatrixId =
  | "iso27001-2022"
  | "iso9001-2026"
  | "nis2"
  | "dora"
  | "cis"
  | "hds";

export type ControlStatus = "covered" | "partial" | "gap" | "out_of_scope";

export interface ControlCell {
  ref: string;
  status: ControlStatus;
  artifactsCount: number;
  title?: string;
}

export interface FrameworkMatrixProps {
  framework: FrameworkMatrixId;
  controls: ControlCell[];
  cols?: number;
  cellSize?: number;
  onCellClick?: (ref: string) => void;
  className?: string;
}

const STATUS_BG: Record<ControlStatus, string> = {
  covered: "var(--egide-color-success)",
  partial: "var(--egide-color-warning)",
  gap: "var(--egide-color-danger)",
  out_of_scope: "var(--egide-color-border-strong)",
};

const STATUS_LABEL: Record<ControlStatus, string> = {
  covered: "Covered",
  partial: "Partial",
  gap: "Gap",
  out_of_scope: "Out of scope",
};

export function FrameworkMatrix({
  framework,
  controls,
  cols = 16,
  cellSize = 18,
  onCellClick,
  className,
}: FrameworkMatrixProps) {
  const containerStyle: CSSProperties = {
    fontFamily: "var(--egide-font-ui)",
    color: "var(--egide-color-text-primary)",
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gap: 2,
    padding: "var(--egide-space-2)",
    border: "1px solid var(--egide-color-border)",
    borderRadius: "var(--egide-radius)",
    background: "var(--egide-color-surface)",
    width: "fit-content",
  };

  const totals: Record<ControlStatus, number> = {
    covered: 0,
    partial: 0,
    gap: 0,
    out_of_scope: 0,
  };
  for (const c of controls) totals[c.status] += 1;

  return (
    <div className={className} style={containerStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "var(--egide-space-2)",
          gap: "var(--egide-space-3)",
        }}
      >
        <h3 style={{ fontSize: "var(--egide-text-base)", fontWeight: 500, margin: 0 }}>
          {framework}
        </h3>
        <span
          style={{
            color: "var(--egide-color-text-muted)",
            fontSize: "var(--egide-text-xs)",
            fontFeatureSettings: '"tnum"',
          }}
        >
          {controls.length} controls · {totals.covered} covered · {totals.gap} gap
        </span>
      </div>

      <table
        style={{ ...gridStyle, borderCollapse: "separate" }}
        aria-label={`Coverage matrix for ${framework}`}
      >
        <tbody style={{ display: "contents" }}>
        {controls.map((cell) => {
          const titleAttr = `${cell.ref} — ${STATUS_LABEL[cell.status]} (${cell.artifactsCount} artifact${cell.artifactsCount === 1 ? "" : "s"})${cell.title ? `\n${cell.title}` : ""}`;
          const cellStyle: CSSProperties = {
            width: cellSize,
            height: cellSize,
            background: STATUS_BG[cell.status],
            borderRadius: "var(--egide-radius-sm)",
            cursor: onCellClick ? "pointer" : "default",
            border: "none",
            padding: 0,
            transition: "outline-color var(--egide-duration) var(--egide-ease-out)",
            outline: "1px solid transparent",
          };
          if (onCellClick) {
            return (
              <td key={cell.ref} style={{ padding: 0 }}>
                <button
                  type="button"
                  title={titleAttr}
                  aria-label={titleAttr}
                  onClick={() => onCellClick(cell.ref)}
                  style={{ ...cellStyle, display: "block" }}
                />
              </td>
            );
          }
          return (
            <td
              key={cell.ref}
              title={titleAttr}
              aria-label={titleAttr}
              style={cellStyle}
            />
          );
        })}
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          gap: "var(--egide-space-3)",
          marginTop: "var(--egide-space-2)",
          fontSize: "var(--egide-text-xs)",
          color: "var(--egide-color-text-muted)",
        }}
      >
        {(Object.keys(STATUS_BG) as ControlStatus[]).map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                background: STATUS_BG[s],
                borderRadius: "var(--egide-radius-sm)",
              }}
            />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
