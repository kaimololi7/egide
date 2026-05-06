/**
 * Open Graph preview image (1200×630) — flat tokens, no gradient,
 * no shadow, no decorative effect. Honest scope: H1 + tagline + cascade
 * summary in mono. ADR 017 compliant.
 */
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Egide — Sovereign GRC platform · directive → policy → procedure → executable cascade";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0a0a",
        color: "#ededed",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: "monospace",
          fontSize: 22,
          color: "#888",
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            background: "#3da9fc",
          }}
        />
        egide
      </div>

      {/* Headline */}
      <div
        style={{
          marginTop: 56,
          fontSize: 76,
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          maxWidth: 980,
          display: "flex",
        }}
      >
        Sovereign GRC. Compiles to real policy.
      </div>

      {/* Subhead */}
      <div
        style={{
          marginTop: 28,
          fontSize: 28,
          color: "#a3a3a3",
          maxWidth: 980,
          display: "flex",
          lineHeight: 1.35,
        }}
      >
        ISO 27001 · NIS2 · DORA → Rego · Ansible · Kyverno. Air-gappable. AGPL core.
      </div>

      {/* Cascade ASCII */}
      <div
        style={{
          marginTop: "auto",
          padding: "20px 24px",
          border: "1px solid #1f1f1f",
          borderRadius: 8,
          background: "#111",
          fontFamily: "monospace",
          fontSize: 20,
          color: "#a3a3a3",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex" }}>
          <span style={{ color: "#3da9fc" }}>anchor</span>
          <span>{"  ISO 27001 · A.8.13 — Information backup"}</span>
        </div>
        <div style={{ display: "flex" }}>
          <span style={{ color: "#3da9fc" }}>policy</span>
          <span>{"  P-014 · Backup required (signed, v3)"}</span>
        </div>
        <div style={{ display: "flex" }}>
          <span style={{ color: "#3da9fc" }}>intent</span>
          <span>{"  db_backup_required → policy.rego ✓"}</span>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 72,
          fontFamily: "monospace",
          fontSize: 16,
          color: "#666",
          display: "flex",
        }}
      >
        github.com/egide-platform/egide
      </div>
    </div>,
    { ...size },
  );
}
