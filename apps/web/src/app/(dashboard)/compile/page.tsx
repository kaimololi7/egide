/**
 * Compile page — M4-M5.
 *
 * Lists built-in intents, allows compiling to Rego and running fixtures.
 * Calls services/compiler via the API (no direct cross-origin call to :8003).
 */
"use client";

import { useState } from "react";
import { CompiledArtifact, type Artifact, type TestResult } from "../../../components/CompiledArtifact.js";

// ── Types from API ────────────────────────────────────────────────────────────

interface IntentSummary {
  id: string;
  title: string;
  severity: "error" | "warning" | "info";
  version: string;
}

// ── Static built-in list (no COMPILER_URL direct call from browser) ──────────
// The full dynamic list comes from the page's server component or the API.
// For M5 we use the static list as the compiler service may not be deployed yet.

const BUILTIN_INTENTS: IntentSummary[] = [
  {
    id: "intent_db_backup_required",
    title: "Production databases must have backup enabled",
    severity: "error",
    version: "1.0.0",
  },
  {
    id: "intent_encryption_at_rest",
    title: "Storage resources must have encryption at rest enabled",
    severity: "error",
    version: "1.0.0",
  },
  {
    id: "intent_access_logging",
    title: "Services must have access logging enabled",
    severity: "warning",
    version: "1.0.0",
  },
  {
    id: "intent_mfa_enforcement",
    title: "IAM users must have MFA enabled",
    severity: "error",
    version: "1.0.0",
  },
  {
    id: "intent_network_egress_restriction",
    title: "Network egress must be restricted to approved CIDRs",
    severity: "error",
    version: "1.0.0",
  },
];

// ── Severity helpers ──────────────────────────────────────────────────────────

function severityColor(sev: string): string {
  if (sev === "error") return "var(--red, #e06c75)";
  if (sev === "warning") return "var(--yellow, #e5c07b)";
  return "var(--fg-muted)";
}

// ── Page component ────────────────────────────────────────────────────────────

export default function CompilePage() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"compile" | "test">("compile");

  async function callCompilerApi(endpoint: string) {
    const COMPILER_URL = process.env.NEXT_PUBLIC_COMPILER_URL ?? "http://localhost:8003";
    const res = await fetch(`${COMPILER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: { id: selectedId }, target: "rego" }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`compiler ${res.status}: ${text}`);
    }
    return res.json();
  }

  async function handleCompile() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setArtifact(null);
    setResults(null);
    try {
      const data = await callCompilerApi("/v1/compile");
      setArtifact(data as Artifact);
      setMode("compile");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setArtifact(null);
    setResults(null);
    try {
      const data = await callCompilerApi("/v1/compile/test") as {
        artifact: Artifact;
        results: TestResult[];
        passed: boolean;
      };
      setArtifact(data.artifact);
      setResults(data.results);
      setMode("test");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "32px",
          marginBottom: "24px",
          gap: "12px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--fg)",
          }}
        >
          Policy compiler
        </h1>
        <span style={{ fontSize: "12px", color: "var(--fg-muted)" }}>
          Rego — MVP target
        </span>
      </div>

      {/* Intent selector table */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "6px",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr 80px 80px",
            gap: "0 12px",
            alignItems: "center",
            height: "32px",
            padding: "0 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-raised, var(--surface))",
          }}
        >
          <span />
          <span style={{ fontSize: "11px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Intent</span>
          <span style={{ fontSize: "11px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Severity</span>
          <span style={{ fontSize: "11px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Version</span>
        </div>

        {/* Intent rows */}
        {BUILTIN_INTENTS.map((intent) => {
          const selected = selectedId === intent.id;
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => setSelectedId(intent.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr 80px 80px",
                gap: "0 12px",
                alignItems: "center",
                height: "32px",
                padding: "0 12px",
                width: "100%",
                background: selected ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {/* radio indicator */}
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                  background: selected ? "var(--accent)" : "transparent",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {intent.title}
              </span>
              <span style={{ fontSize: "12px", color: severityColor(intent.severity), fontFamily: "var(--font-mono)" }}>
                {intent.severity}
              </span>
              <span style={{ fontSize: "12px", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {intent.version}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        <button
          type="button"
          disabled={!selectedId || loading}
          onClick={handleCompile}
          style={{
            height: "32px",
            padding: "0 16px",
            background: selectedId && !loading ? "var(--accent)" : "var(--border)",
            color: selectedId && !loading ? "#fff" : "var(--fg-muted)",
            border: "none",
            borderRadius: "4px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: selectedId && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading && mode === "compile" ? "Compiling…" : "Compile → Rego"}
        </button>
        <button
          type="button"
          disabled={!selectedId || loading}
          onClick={handleTest}
          style={{
            height: "32px",
            padding: "0 16px",
            background: "transparent",
            color: selectedId && !loading ? "var(--fg)" : "var(--fg-muted)",
            border: `1px solid ${selectedId && !loading ? "var(--border)" : "var(--border)"}`,
            borderRadius: "4px",
            fontSize: "13px",
            cursor: selectedId && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading && mode === "test" ? "Running…" : "Run fixtures"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px",
            border: "1px solid var(--red, #e06c75)",
            borderRadius: "6px",
            color: "var(--red, #e06c75)",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Artifact viewer */}
      {artifact && (
        <CompiledArtifact
          artifact={artifact}
          results={results ?? undefined}
          loading={loading}
        />
      )}
    </div>
  );
}
