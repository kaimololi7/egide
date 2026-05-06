/**
 * CascadeSVG — animated cascade for the landing hero.
 *
 * Hand-coded SVG, 8s loop, CSS-only animations (no external library).
 * Tokens-only colors (cf. ADR 017 + docs/design-system.md).
 *
 * Layout: 4 vertical layers (STRATEGIC / TACTICAL / OPERATIONAL /
 * EXECUTABLE). Each node carries a type label, a title, and a
 * metadata line (anchor mapping, sha hash, target marker). The
 * intent splits into 3 compiled artifacts (Rego / Ansible / CIS).
 * The Rego artifact then triggers a live enforcement log line at t=6s.
 *
 * Sequence:
 *   t=0.0s  layer rails appear
 *   t=0.4s  anchor "ISO 27001 · A.8.13" (+ NIS2 cross-map chip)
 *   t=1.4s  policy P-014 (status: signed)
 *   t=2.4s  procedure PR-014
 *   t=3.4s  intent + sha line
 *   t=4.4s  3 compiled artifacts (rego / ansible / cis)
 *   t=6.0s  Rego pulses accent + outcome log line
 *   t=8.0s  fade out, restart
 *
 * Server component. No client JS. Respects prefers-reduced-motion.
 */

import styles from "./CascadeSVG.module.css";

export function CascadeSVG() {
  return (
    <div className={styles.frame}>
      <div className={styles.chrome}>
        <span className={styles.chromeLabel}>cascade · live</span>
        <span className={styles.chromeMeta}>iso27001-2022 → opa</span>
      </div>

      <svg
        viewBox="0 0 520 560"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Cascade from a normative anchor down to a Rego rule blocking a non-compliant Pod"
        className={styles.svg}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,1 L6,4 L0,7" className={styles.arrowHead} fill="none" />
          </marker>
          <marker
            id="arrow-accent"
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,1 L6,4 L0,7" className={styles.arrowHeadAccent} fill="none" />
          </marker>
        </defs>

        {/* ── Layer rails ──────────────────────────────────────────── */}
        <g className={styles.rails}>
          <text x="14" y="62" className={styles.railLabel}>STRATEGIC</text>
          <text x="14" y="162" className={styles.railLabel}>TACTICAL</text>
          <text x="14" y="262" className={styles.railLabel}>OPERATIONAL</text>
          <text x="14" y="380" className={styles.railLabel}>EXECUTABLE</text>
          <line x1="100" y1="20" x2="100" y2="540" className={styles.railLine} />
        </g>

        {/* ── L1 ANCHOR ────────────────────────────────────────────── */}
        <a href="#code-anchor" className={styles.nodeLink}>
          <title>Jump to anchor traceability → ISO 27001 · A.8.13</title>
          <g className={styles.node} style={{ animationDelay: "0.4s" }}>
            <rect x="120" y="28" width="380" height="60" rx="6" className={styles.anchorBox} />
            <text x="136" y="46" className={styles.label}>ANCHOR</text>
            <text x="136" y="66" className={styles.title}>ISO 27001 · A.8.13</text>
            <text x="136" y="82" className={styles.meta}>Information backup</text>
            <g transform="translate(360, 50)">
              <rect width="124" height="22" rx="4" className={styles.chip} />
              <text x="62" y="15" className={styles.chipText} textAnchor="middle">
                + NIS2 Art.21.2.c
              </text>
            </g>
            <circle cx="490" cy="42" r="4" className={styles.statusOk} />
          </g>
        </a>

        <line x1="310" y1="92" x2="310" y2="124" className={styles.arrow}
          markerEnd="url(#arrow)" style={{ animationDelay: "1.0s" }} />

        {/* ── L2 POLICY ────────────────────────────────────────────── */}
        <a href="#code-deny" className={styles.nodeLink}>
          <title>Jump to deny rule → P-014 Backup required</title>
          <g className={styles.node} style={{ animationDelay: "1.4s" }}>
            <rect x="120" y="128" width="380" height="60" rx="6" className={styles.policyBox} />
            <text x="136" y="146" className={styles.label}>POLICY</text>
            <text x="136" y="166" className={styles.title}>P-014 · Backup required</text>
            <text x="136" y="182" className={styles.meta}>v3 · approved · 2 reviewers</text>
            <g transform="translate(404, 150)">
              <rect width="80" height="22" rx="4" className={styles.chip} />
              <text x="40" y="15" className={styles.chipText} textAnchor="middle">signed</text>
            </g>
            <circle cx="490" cy="142" r="4" className={styles.statusOk} />
          </g>
        </a>

        <line x1="310" y1="192" x2="310" y2="224" className={styles.arrow}
          markerEnd="url(#arrow)" style={{ animationDelay: "2.0s" }} />

        {/* ── L3 PROCEDURE ─────────────────────────────────────────────── */}
        <a href="#code-deny" className={styles.nodeLink}>
          <title>Jump to procedure context → PR-014 Daily DB snapshot</title>
          <g className={styles.node} style={{ animationDelay: "2.4s" }}>
            <rect x="120" y="228" width="380" height="60" rx="6" className={styles.procedureBox} />
            <text x="136" y="246" className={styles.label}>PROCEDURE</text>
            <text x="136" y="266" className={styles.title}>PR-014 · Daily DB snapshot</text>
            <text x="136" y="282" className={styles.meta}>BPMN · 6 steps · KPI K-014 attached</text>
            <circle cx="490" cy="242" r="4" className={styles.statusOk} />
          </g>
        </a>

        <line x1="310" y1="292" x2="310" y2="324" className={styles.arrow}
          markerEnd="url(#arrow)" style={{ animationDelay: "3.0s" }} />

        {/* ── L4 INTENT ────────────────────────────────────────────── */}
        <a href="#code-anchor" className={styles.nodeLink}>
          <title>Jump to anchor verification → db_backup_required</title>
          <g className={styles.node} style={{ animationDelay: "3.4s" }}>
            <rect x="120" y="328" width="380" height="60" rx="6" className={styles.intentBox} />
            <text x="136" y="346" className={styles.label}>INTENT</text>
            <text x="136" y="366" className={`${styles.title} ${styles.titleMono}`}>
              db_backup_required
            </text>
            <text x="136" y="382" className={`${styles.meta} ${styles.titleMono}`}>
              sha256:1a2b3c · 6 fixtures
            </text>
            <circle cx="490" cy="342" r="4" className={styles.statusOk} />
          </g>
        </a>

        {/* ── Compile splitter ─────────────────────────────────────── */}
        <path d="M310 392 Q310 416 110 432" className={`${styles.arrow} ${styles.dashed}`}
          fill="none" markerEnd="url(#arrow)" style={{ animationDelay: "4.0s" }} />
        <line x1="310" y1="392" x2="310" y2="432" className={`${styles.arrow} ${styles.dashed}`}
          markerEnd="url(#arrow)" style={{ animationDelay: "4.0s" }} />
        <path d="M310 392 Q310 416 460 432" className={`${styles.arrow} ${styles.dashed}`}
          fill="none" markerEnd="url(#arrow)" style={{ animationDelay: "4.0s" }} />
        <text x="320" y="410" className={styles.edgeLabel}>compiles to</text>

        {/* ── L5 ARTIFACTS ─────────────────────────────────────────── */}
        <a href="#code-compile" className={styles.nodeLink}>
          <title>Jump to compiled artifact → OPA Rego</title>
          <g className={styles.node} style={{ animationDelay: "4.4s" }}>
            <rect x="20" y="436" width="180" height="56" rx="6"
              className={`${styles.artifactBox} ${styles.artifactRego}`} />
            <text x="32" y="454" className={styles.label}>OPA · REGO</text>
            <text x="32" y="472" className={`${styles.title} ${styles.titleMono}`}>
              policy.rego
            </text>
            <text x="32" y="486" className={styles.meta}>tested · signed</text>
          </g>
        </a>

        <g className={styles.node} style={{ animationDelay: "4.4s" }}>
          <rect x="220" y="436" width="180" height="56" rx="6" className={styles.artifactBox} />
          <text x="232" y="454" className={styles.label}>ANSIBLE</text>
          <text x="232" y="472" className={`${styles.title} ${styles.titleMono}`}>
            playbook.yml
          </text>
          <text x="232" y="486" className={`${styles.meta} ${styles.dim}`}>m6 · planned</text>
        </g>

        <g className={styles.node} style={{ animationDelay: "4.4s" }}>
          <rect x="370" y="436" width="130" height="56" rx="6" className={styles.artifactBox} />
          <text x="382" y="454" className={styles.label}>CIS</text>
          <text x="382" y="472" className={`${styles.title} ${styles.titleMono}`}>
            check.sh
          </text>
          <text x="382" y="486" className={`${styles.meta} ${styles.dim}`}>m7</text>
        </g>

        {/* ── Enforcement edge ─────────────────────────────────────── */}
        <line x1="110" y1="492" x2="110" y2="516" className={styles.arrowAccent}
          markerEnd="url(#arrow-accent)" style={{ animationDelay: "6.0s" }} />

        {/* ── Outcome log line ─────────────────────────────────────── */}
        <g className={styles.outcome} style={{ animationDelay: "6.0s" }}>
          <rect x="20" y="516" width="480" height="32" rx="4" className={styles.outcomeBox} />
          <text x="32" y="535" className={`${styles.outcomeText} ${styles.titleMono}`}>
            <tspan className={styles.outcomeTimestamp}>12:34:02.187</tspan>
            <tspan dx="10" className={styles.outcomeTag}>DENY</tspan>
            <tspan dx="10">prod-db-3</tspan>
            <tspan dx="6" className={styles.dim}>· backup.enabled missing</tspan>
          </text>
        </g>
      </svg>
    </div>
  );
}
