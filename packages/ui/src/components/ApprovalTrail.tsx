/**
 * <ApprovalTrail> — Ed25519 signature timeline (cf. ADR 010 + 014).
 *
 * Header: status + countdown to expiry.
 * Body: list of signatures with approver, decision (icon), comment, signedAt.
 * Pending slots = empty rows ("awaiting").
 */

import type { CSSProperties } from "react";

export type ApprovalKind =
  | "ansible_apply"
  | "directive_signature"
  | "artifact_publication"
  | "rule_exception"
  | "production_mutation";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface Approver {
  name: string;
  email: string;
}

export interface Signature {
  approver: Approver;
  decision: "approve" | "reject";
  comment?: string;
  signedAt: string;
  signature: string;
}

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  requiredApprovals: number;
  expiresAt: string;
}

export interface ApprovalTrailProps {
  request: ApprovalRequest;
  signatures: Signature[];
  className?: string;
}

const STATUS_COLOR: Record<ApprovalStatus, string> = {
  pending: "var(--egide-color-warning)",
  approved: "var(--egide-color-success)",
  rejected: "var(--egide-color-danger)",
  expired: "var(--egide-color-text-muted)",
};

function shortSig(sig: string): string {
  if (sig.length <= 14) return sig;
  return `${sig.slice(0, 8)}…${sig.slice(-4)}`;
}

function timeUntil(iso: string): string {
  const expiry = new Date(iso).getTime();
  const now = Date.now();
  const diff = expiry - now;
  if (diff <= 0) return "expired";
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 24) return `expires in ${Math.floor(hours / 24)}d`;
  if (hours >= 1) return `expires in ${hours}h`;
  return `expires in ${Math.floor(diff / 60_000)}m`;
}

export function ApprovalTrail({ request, signatures, className }: ApprovalTrailProps) {
  const collected = signatures.length;
  const pendingSlots = Math.max(0, request.requiredApprovals - collected);

  const header: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "var(--egide-space-3)",
    paddingBottom: "var(--egide-space-3)",
    borderBottom: "1px solid var(--egide-color-border)",
    marginBottom: "var(--egide-space-3)",
  };

  const badgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--egide-space-1)",
    padding: "3px 8px",
    borderRadius: "var(--egide-radius)",
    border: `1px solid ${STATUS_COLOR[request.status]}`,
    color: STATUS_COLOR[request.status],
    fontSize: "var(--egide-text-xs)",
    fontFamily: "var(--egide-font-mono)",
    textTransform: "uppercase",
    letterSpacing: "var(--egide-tracking-wide)",
  };

  return (
    <section
      className={className}
      aria-label={`Approval trail for ${request.id}`}
      style={{
        fontFamily: "var(--egide-font-ui)",
        color: "var(--egide-color-text-primary)",
      }}
    >
      <div style={header}>
        <div>
          <span style={badgeStyle}>{request.status}</span>
          <span
            style={{
              marginLeft: "var(--egide-space-3)",
              color: "var(--egide-color-text-secondary)",
              fontSize: "var(--egide-text-sm)",
            }}
          >
            {collected}/{request.requiredApprovals} signature{request.requiredApprovals > 1 ? "s" : ""}
          </span>
        </div>
        <span
          style={{
            color: "var(--egide-color-text-muted)",
            fontSize: "var(--egide-text-xs)",
            fontFeatureSettings: '"tnum"',
          }}
        >
          {timeUntil(request.expiresAt)}
        </span>
      </div>

      <ol
        style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--egide-space-2)" }}
      >
        {signatures.map((s) => (
          <li
            key={s.signature}
            style={{
              padding: "var(--egide-space-3)",
              border: "1px solid var(--egide-color-border)",
              borderRadius: "var(--egide-radius)",
              background: "var(--egide-color-surface)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "var(--egide-space-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--egide-space-2)" }}>
                <span
                  aria-hidden
                  style={{
                    color: s.decision === "approve" ? "var(--egide-color-success)" : "var(--egide-color-danger)",
                    fontFamily: "var(--egide-font-mono)",
                  }}
                >
                  {s.decision === "approve" ? "✓" : "✗"}
                </span>
                <strong style={{ fontWeight: 500 }}>{s.approver.name}</strong>
                <span style={{ color: "var(--egide-color-text-muted)", fontSize: "var(--egide-text-xs)" }}>
                  ({s.approver.email})
                </span>
              </div>
              <time
                dateTime={s.signedAt}
                style={{
                  color: "var(--egide-color-text-muted)",
                  fontSize: "var(--egide-text-xs)",
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {s.signedAt}
              </time>
            </div>
            {s.comment && (
              <p
                style={{
                  marginTop: "var(--egide-space-2)",
                  color: "var(--egide-color-text-secondary)",
                  fontSize: "var(--egide-text-sm)",
                }}
              >
                {s.comment}
              </p>
            )}
            <div
              style={{
                marginTop: "var(--egide-space-2)",
                fontFamily: "var(--egide-font-mono)",
                fontSize: "var(--egide-text-xs)",
                color: "var(--egide-color-text-muted)",
              }}
            >
              sig:{shortSig(s.signature)}
            </div>
          </li>
        ))}

        {Array.from({ length: pendingSlots }).map((_, i) => (
          <li
            key={`pending-slot-${request.id}-${collected + i}`}
            style={{
              padding: "var(--egide-space-3)",
              border: "1px dashed var(--egide-color-border-strong)",
              borderRadius: "var(--egide-radius)",
              color: "var(--egide-color-text-muted)",
              fontSize: "var(--egide-text-sm)",
              fontStyle: "italic",
            }}
          >
            awaiting signature {collected + i + 1}/{request.requiredApprovals}
          </li>
        ))}
      </ol>
    </section>
  );
}
