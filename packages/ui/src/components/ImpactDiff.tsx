/**
 * <ImpactDiff> — before/after diff for approval-gated actions.
 *
 * Cf. docs/design-system.md §ImpactDiff + ADR 010 (approval workflow).
 *
 * Renders a JSON or YAML diff with semantic colors. Text-based diff,
 * no syntax highlighting (caller can wrap in <RegoSyntax> if Rego).
 */

import type { CSSProperties } from "react";

export interface ImpactDiffProps {
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  format?: "yaml" | "json";
  scope?: string;
  className?: string;
}

type DiffOp = "add" | "remove" | "context";

interface DiffLine {
  op: DiffOp;
  text: string;
}

function renderJson(o: Record<string, unknown>): string {
  return JSON.stringify(o, null, 2);
}

/** Naive line-diff: marks lines unique to each side. Stable, no library. */
function lineDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < beforeLines.length || j < afterLines.length) {
    const b = beforeLines[i];
    const a = afterLines[j];
    if (b === undefined) {
      result.push({ op: "add", text: a ?? "" });
      j += 1;
    } else if (a === undefined) {
      result.push({ op: "remove", text: b });
      i += 1;
    } else if (b === a) {
      result.push({ op: "context", text: b });
      i += 1;
      j += 1;
    } else if (!afterSet.has(b)) {
      result.push({ op: "remove", text: b });
      i += 1;
    } else if (!beforeSet.has(a)) {
      result.push({ op: "add", text: a });
      j += 1;
    } else {
      result.push({ op: "context", text: b });
      i += 1;
      j += 1;
    }
  }
  return result;
}

const OP_BG: Record<DiffOp, string> = {
  add: "var(--egide-color-success-bg)",
  remove: "var(--egide-color-danger-bg)",
  context: "transparent",
};

const OP_BORDER: Record<DiffOp, string> = {
  add: "var(--egide-color-success)",
  remove: "var(--egide-color-danger)",
  context: "transparent",
};

const OP_PREFIX: Record<DiffOp, string> = {
  add: "+",
  remove: "-",
  context: " ",
};

export function ImpactDiff({
  beforeState,
  afterState,
  format = "json",
  scope,
  className,
}: ImpactDiffProps) {
  const beforeText = format === "json" ? renderJson(beforeState) : renderJson(beforeState);
  const afterText = format === "json" ? renderJson(afterState) : renderJson(afterState);
  const lines = lineDiff(beforeText, afterText);

  const containerStyle: CSSProperties = {
    fontFamily: "var(--egide-font-mono)",
    fontSize: "var(--egide-text-sm)",
    color: "var(--egide-color-text-primary)",
    border: "1px solid var(--egide-color-border)",
    borderRadius: "var(--egide-radius)",
    background: "var(--egide-color-surface)",
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    padding: "var(--egide-space-2) var(--egide-space-3)",
    background: "var(--egide-color-surface-raised)",
    borderBottom: "1px solid var(--egide-color-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "var(--egide-text-xs)",
    color: "var(--egide-color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "var(--egide-tracking-wide)",
  };

  return (
    <div className={className} style={containerStyle} aria-label="Impact diff">
      <div style={headerStyle}>
        <span>{format === "json" ? "JSON diff" : "YAML diff"}</span>
        {scope && <span style={{ fontFamily: "var(--egide-font-mono)" }}>{scope}</span>}
      </div>
      <pre
        style={{
          margin: 0,
          padding: "var(--egide-space-2) 0",
          overflowX: "auto",
        }}
      >
        {lines.map((line, i) => (
          <span
            key={`${line.op}-${i}-${line.text}`}
            style={{
              display: "block",
              padding: "0 var(--egide-space-3)",
              background: OP_BG[line.op],
              borderLeft: `2px solid ${OP_BORDER[line.op]}`,
              whiteSpace: "pre",
              minHeight: "1.5em",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                color: "var(--egide-color-text-muted)",
                marginRight: "var(--egide-space-2)",
                userSelect: "none",
              }}
              aria-hidden
            >
              {OP_PREFIX[line.op]}
            </span>
            {line.text}
          </span>
        ))}
      </pre>
    </div>
  );
}
