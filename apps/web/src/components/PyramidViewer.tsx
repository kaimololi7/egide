"use client";
/**
 * PyramidViewer — read-only recursive tree of pyramid nodes.
 *
 * Color-coded by layer, shows anchor citations.
 * Design: ADR 017 — 32px rows, tokens only, no box-shadow.
 */

export type Layer = "directive" | "policy" | "procedure" | "process" | "kpi";

export interface PyramidNode {
  id: string;
  layer: Layer;
  title: string;
  content?: string;
  normativeAnchors?: string[];
  children?: PyramidNode[];
}

const LAYER_COLOR: Record<Layer, string> = {
  directive: "var(--color-fw-iso27001)",
  policy: "var(--color-accent)",
  procedure: "var(--color-fw-nis2)",
  process: "var(--color-fw-dora)",
  kpi: "var(--color-fw-cis)",
};

const LAYER_LABEL: Record<Layer, string> = {
  directive: "DIR",
  policy: "POL",
  procedure: "PRC",
  process: "PROC",
  kpi: "KPI",
};

interface NodeRowProps {
  node: PyramidNode;
  depth: number;
}

function NodeRow({ node, depth }: NodeRowProps) {
  const color = LAYER_COLOR[node.layer];
  const label = LAYER_LABEL[node.layer];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "32px",
          paddingLeft: `${4 + depth * 20}px`,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Layer badge */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color,
            width: "36px",
            flexShrink: 0,
          }}
        >
          {label}
        </span>

        {/* Title */}
        <span
          style={{
            flex: 1,
            fontSize: "var(--text-sm)",
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.title}
        </span>

        {/* Anchor chips */}
        {node.normativeAnchors && node.normativeAnchors.length > 0 && (
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            {node.normativeAnchors.slice(0, 3).map((anchor) => (
              <span
                key={anchor}
                title={anchor}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "1px 4px",
                  maxWidth: "90px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {anchor}
              </span>
            ))}
            {node.normativeAnchors.length > 3 && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--color-text-muted)",
                }}
              >
                +{node.normativeAnchors.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {node.children?.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

interface PyramidViewerProps {
  roots: PyramidNode[];
}

export function PyramidViewer({ roots }: PyramidViewerProps) {
  if (roots.length === 0) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        No nodes to display.
      </p>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        background: "var(--color-surface)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "32px",
          paddingLeft: "4px",
          paddingRight: "12px",
          borderBottom: "1px solid var(--color-border-strong)",
          background: "var(--color-surface-raised)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            width: "36px",
          }}
        >
          LAYER
        </span>
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
          }}
        >
          TITLE
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
          }}
        >
          ANCHORS
        </span>
      </div>

      {roots.map((root) => (
        <NodeRow key={root.id} node={root} depth={0} />
      ))}
    </div>
  );
}
