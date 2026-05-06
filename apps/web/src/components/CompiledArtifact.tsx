/**
 * CompiledArtifact — signature component (ADR 017).
 *
 * Displays a compiled policy artifact (Rego, Ansible, Kyverno…)
 * with shiki syntax highlighting, normative anchor chips, decision badge,
 * and content hash.
 *
 * Design rules (ADR 017):
 * - 32px header row density
 * - Tokens only — no hard-coded colors, no box-shadow
 * - Border-radius max 8px
 * - Dark mode default
 * - No Aceternity / Magic UI
 */
"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Artifact {
  intent_id: string;
  target: string;
  content: string;
  content_hash: string;
  tests_passed: number;
  tests_total: number;
  normative_anchors?: string[];
  package_name?: string;
  decision?: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  expect: string;
  got: string;
  message?: string;
}

interface CompiledArtifactProps {
  artifact: Artifact;
  results?: TestResult[];
  loading?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AnchorChip({ anchor }: { anchor: string }) {
  const [prefix, rest] = anchor.includes(":") ? anchor.split(":") : ["", anchor];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "20px",
        padding: "0 6px",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color: "var(--fg-muted)",
        whiteSpace: "nowrap",
        gap: "4px",
      }}
    >
      {prefix && (
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{prefix}</span>
      )}
      {prefix && <span style={{ color: "var(--border)" }}>:</span>}
      <span>{rest}</span>
    </span>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const color =
    decision === "deny"
      ? "var(--red, #e06c75)"
      : decision === "warn"
        ? "var(--yellow, #e5c07b)"
        : "var(--accent)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "20px",
        padding: "0 6px",
        border: `1px solid ${color}`,
        borderRadius: "4px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color,
        fontWeight: 600,
      }}
    >
      {decision}
    </span>
  );
}

// ── Code highlighter ──────────────────────────────────────────────────────────

function RegoCode({ code }: { code: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: "rego",
      theme: "github-dark-dimmed",
    })
      .then((h) => {
        if (!cancelled) setHtml(h);
      })
      .catch(() => {
        // fallback — plain code
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (html) {
    return (
      <div
        style={{ fontSize: "13px", lineHeight: "20px" }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki-generated safe HTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Plain fallback
  return (
    <pre
      style={{
        margin: 0,
        padding: "12px 16px",
        fontSize: "13px",
        lineHeight: "20px",
        color: "var(--fg)",
        fontFamily: "var(--font-mono)",
        overflow: "auto",
        whiteSpace: "pre",
      }}
    >
      {code}
    </pre>
  );
}

// ── Test results table ────────────────────────────────────────────────────────

function TestResultsTable({ results }: { results: TestResult[] }) {
  const passed = results.filter((r) => r.passed).length;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "32px",
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
          fixtures
        </span>
        <span
          style={{
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            color: passed === results.length ? "var(--accent)" : "var(--red, #e06c75)",
          }}
        >
          {passed}/{results.length}
        </span>
      </div>
      {results.map((r) => (
        <div
          key={r.name}
          style={{
            display: "flex",
            alignItems: "center",
            height: "32px",
            padding: "0 12px",
            gap: "10px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: r.passed ? "var(--accent)" : "var(--red, #e06c75)",
              minWidth: "12px",
            }}
          >
            {r.passed ? "✓" : "✗"}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: r.passed ? "var(--fg)" : "var(--fg-muted)",
              flexGrow: 1,
            }}
          >
            {r.name}
          </span>
          {!r.passed && (
            <span
              style={{ fontSize: "11px", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}
            >
              expected {r.expect} got {r.got}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px",
      }}
    >
      {[180, 140, 200, 120, 160].map((w) => (
        <div
          key={w}
          style={{
            height: "14px",
            width: `${w}px`,
            background: "var(--border)",
            borderRadius: "4px",
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CompiledArtifact({ artifact, results, loading }: CompiledArtifactProps) {
  const anchors = artifact.normative_anchors ?? [];
  const packageName = artifact.package_name ?? extractPackage(artifact.content);
  const decision = artifact.decision ?? extractDecision(artifact.content);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "6px",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      {/* Header row — 32px density */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "32px",
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          gap: "8px",
        }}
      >
        {/* Target badge */}
        <span
          style={{
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "var(--fg-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {artifact.target}
        </span>

        {/* Package name */}
        {packageName && (
          <>
            <span style={{ color: "var(--border)", fontSize: "12px" }}>·</span>
            <span
              style={{
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--fg)",
                flexGrow: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {packageName}
            </span>
          </>
        )}

        {/* Decision badge */}
        {decision && <DecisionBadge decision={decision} />}

        {/* Normative anchors (max 3 visible) */}
        {anchors.slice(0, 3).map((a) => (
          <AnchorChip key={a} anchor={a} />
        ))}
        {anchors.length > 3 && (
          <span style={{ fontSize: "11px", color: "var(--fg-muted)" }}>
            +{anchors.length - 3}
          </span>
        )}
      </div>

      {/* Code area */}
      <div
        style={{
          maxHeight: "480px",
          overflowY: "auto",
          background: "#0d1117",
        }}
      >
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <RegoCode code={artifact.content} />
        )}
      </div>

      {/* Footer — hash + test status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "32px",
          padding: "0 12px",
          borderTop: "1px solid var(--border)",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--fg-muted)", flexGrow: 1 }}>
          {artifact.content_hash.slice(0, 20)}…
        </span>
        {artifact.tests_total > 0 && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color:
                artifact.tests_passed === artifact.tests_total
                  ? "var(--accent)"
                  : "var(--red, #e06c75)",
            }}
          >
            {artifact.tests_passed}/{artifact.tests_total} fixtures
          </span>
        )}
      </div>

      {/* Test results (optional) */}
      {results && results.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <TestResultsTable results={results} />
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPackage(content: string): string {
  const m = content.match(/^package\s+([\w.]+)/m);
  return m?.[1] ?? "";
}

function extractDecision(content: string): string {
  if (content.includes("default deny")) return "deny";
  if (content.includes("default warn")) return "warn";
  if (content.includes("default allow")) return "allow";
  return "";
}
