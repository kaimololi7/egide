/**
 * S3 — Show me the code.
 *
 * Two-column scroll-driven section. Left = explanatory steps with
 * IntersectionObserver triggers ; right = sticky CompiledArtifact panel
 * that highlights the corresponding region as user scrolls.
 *
 * No CodeHike. Plain CSS sticky + IntersectionObserver, ADR 017
 * compliant (no decorative animation, motion budget ≤ 200ms).
 */
"use client";

import { TraceBreadcrumb } from "@egide/ui";
import { useEffect, useRef, useState } from "react";
import styles from "./ShowMeTheCode.module.css";

type StepId = "trace" | "deny" | "anchor" | "compile";

interface Step {
  id: StepId;
  title: string;
  body: React.ReactNode;
  highlightLines: [number, number]; // 1-indexed inclusive range
}

const STEPS: Step[] = [
  {
    id: "trace",
    title: "Every Rego rule traces back.",
    body: (
      <>
        Egide compiles a normalized <code>Intent</code> into Rego. The
        first comment carries a content-addressable pointer to the
        pyramid artifact and the upstream policy.
      </>
    ),
    highlightLines: [3, 4],
  },
  {
    id: "anchor",
    title: "Every cited anchor is verifiable.",
    body: (
      <>
        Anchors like <code>iso27001-2022:A.8.13</code> resolve to a
        signed entry in your normative pack. The hallucination guard
        rejects compilation if any anchor is fabricated.
      </>
    ),
    highlightLines: [12, 12],
  },
  {
    id: "deny",
    title: "Deny rules are explicit, not magic.",
    body: (
      <>
        The deny block is generated from a typed <code>Intent</code>{" "}
        with predicates the validator already understands.
        No regex over YAML, no string templating.
      </>
    ),
    highlightLines: [6, 14],
  },
  {
    id: "compile",
    title: "Tested, signed, observable.",
    body: (
      <>
        Bundle compiled with <code>opa build</code>. Tested against
        fixtures derived from the procedure. Signed with Ed25519.
        Every decision logged to ClickHouse with the originating intent
        sha so you can replay the chain.
      </>
    ),
    highlightLines: [1, 14],
  },
];

const REGO_LINES = [
  "package egide.policies.db.backup",                                                  // 1
  "",                                                                                  // 2
  "# Source: pyramid://P-014/v3 · intent_db_backup_required",                           // 3
  "# Compiled by Egide v0.5.2 at 2026-05-04T12:00:00Z (sha256:1a2b3c…)",                // 4
  "",                                                                                  // 5
  "deny[msg] {",                                                                       // 6
  "    input.resource.kind == \"PostgresCluster\"",                                    // 7
  "    input.resource.metadata.labels[\"egide.io/criticality\"] == \"high\"",         // 8
  "    not input.resource.spec.backup.enabled",                                        // 9
  "    msg := sprintf(",                                                               // 10
  "        \"Production database %v must have backup enabled \" +",                    // 11
  "        \"(iso27001-2022:A.8.13, nis2:Art.21.2.c)\",",                              // 12
  "        [input.resource.metadata.name],",                                           // 13
  "    )",                                                                             // 14
  "}",                                                                                 // 15
];

const FIRST_STEP = STEPS[0] as Step;

export function ShowMeTheCode() {
  const [activeId, setActiveId] = useState<StepId>(FIRST_STEP.id);
  const stepRefs = useRef<Map<StepId, HTMLElement>>(new Map());

  // Sync active step from URL hash (#code-anchor, #code-deny, #code-compile,
  // #code-trace) — used by clickable cascade nodes in the hero.
  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;
    const KNOWN = new Set<StepId>(["trace", "anchor", "deny", "compile"]);
    const applyHash = () => {
      const raw = globalThis.window.location.hash.replace(/^#code-/, "");
      if (KNOWN.has(raw as StepId)) {
        const id = raw as StepId;
        setActiveId(id);
        // Smooth-scroll the corresponding step into view.
        const el = stepRefs.current.get(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    applyHash();
    globalThis.window.addEventListener("hashchange", applyHash);
    return () => globalThis.window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the upper third of the viewport.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target instanceof HTMLElement) {
          const id = top.target.dataset.stepId as StepId | undefined;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.5, 1] },
    );

    for (const el of stepRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const active = STEPS.find((s) => s.id === activeId) ?? FIRST_STEP;

  return (
    <section id="code" className="border-b border-border scroll-mt-12">
      <div className="mx-auto max-w-[1100px] px-6 py-24">
        <h2 className="text-sm uppercase tracking-[0.12em] text-text-muted mb-12">
          Show me the code
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-12 items-start">
          {/* ── Left — scrolling steps ──────────────────────────── */}
          <ol className="space-y-32 lg:space-y-44 max-w-[440px]">
            {STEPS.map((step, idx) => (
              <li
                key={step.id}
                ref={(el) => {
                  if (el) stepRefs.current.set(step.id, el);
                }}
                data-step-id={step.id}
                className="scroll-mt-24"
              >
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-mono text-xs text-text-muted">
                    0{idx + 1}
                  </span>
                  <span
                    className={`h-px flex-1 transition-colors ${
                      activeId === step.id ? "bg-accent" : "bg-border"
                    }`}
                  />
                </div>
                <h3 className="font-display text-[22px] tracking-tight mb-3">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          {/* ── Right — sticky compiled arti space-y-4">
            <TraceBreadcrumb
              steps={[
                {
                  level: "directive",
                  id: "ISO 27001 · A.8.13",
                  meta: "+ NIS2 Art.21.2.c",
                },
                {
                  level: "policy",
                  id: "P-014",
                  meta: "v3 · signed",
                },
                {
                  level: "procedure",
                  id: "PR-014",
                  meta: "BPMN · 6 steps",
                },
                {
                  level: "intent",
                  id: "db_backup_required",
                  meta: "sha256:1a2b3c…",
                },
                {
                  level: "artifact",
                  id: "policy.rego",
                  meta: "OPA · 6 fixtures",
                  current: true,
                },
              ]}
            />
ct ────────────────── */}
          <div className="lg:sticky lg:top-20">
            <div className={styles.frame}>
              <div className={styles.chrome}>
                <span className={styles.chromeLabel}>policy.rego</span>
                <span className={styles.chromeMeta}>
                  intent_db_backup_required · sha256:1a2b3c…
                </span>
              </div>
              <pre className={styles.body}>
                {REGO_LINES.map((line, i) => {
                  const lineNum = i + 1;
                  const inRange =
                    lineNum >= active.highlightLines[0] &&
                    lineNum <= active.highlightLines[1];
                  return (
                    <span
                      key={`l-${lineNum}`}
                      className={`${styles.line} ${inRange ? styles.lineActive : ""}`}
                    >
                      <span className={styles.lineNum}>{lineNum}</span>
                      <span className={styles.lineCode}>{line || " "}</span>
                    </span>
                  );
                })}
              </pre>
              <div className={styles.footer}>
                <span className={styles.footerOk}>● 6/6 fixtures</span>
                <span className={styles.footerSep}>·</span>
                <span>Ed25519 signed</span>
                <span className={styles.footerSep}>·</span>
                <span className={styles.footerMuted}>built 187ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
