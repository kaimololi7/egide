/**
 * Egide NATS subjects — versioned `egide.v1.*` per ADR 008 + ADR 015.
 *
 * Adding a new subject:
 *   1. Add a `Subjects.X` constant.
 *   2. Add its payload schema in SubjectPayloads.
 *   3. Decide which stream owns it (cf. streams.ts).
 *   4. Update threat model if it crosses a trust boundary.
 */

import { z } from "zod";

/** All Egide v1 subjects, organized by domain. */
export const Subjects = {
  // ── Documents (J1 ingestion) ─────────────────────────────
  DocsUploaded: "egide.v1.docs.uploaded",
  DocsExtracted: "egide.v1.docs.extracted",

  // ── Pyramid lifecycle ────────────────────────────────────
  PyramidRequested: "egide.v1.pyramid.requested",
  PyramidGenerated: "egide.v1.pyramid.generated",
  PyramidMutations: "egide.v1.pyramid.mutations",
  PyramidProgress: "egide.v1.pyramid.progress", // long-running stream

  // ── Compilation ──────────────────────────────────────────
  CompilerRequested: "egide.v1.compiler.requested",
  CompilerCompleted: "egide.v1.compiler.completed",

  // ── Audit & telemetry ────────────────────────────────────
  AuditEvents: "egide.v1.audit.events",
  ComplianceFindings: "egide.v1.compliance.findings",

  // ── Governance (J6 / J9) ─────────────────────────────────
  GovernanceActions: "egide.v1.governance.actions",

  // ── LLM call audit fan-out ───────────────────────────────
  LlmCalls: "egide.v1.llm.calls",

  // ── DLQ (failed handlers after MaxDeliver) ───────────────
  Dlq: "egide.v1.dlq",
} as const;

export type EgideSubject = (typeof Subjects)[keyof typeof Subjects];

/** Tenant ID is mandatory in every subject payload. */
const TenantPayload = z.object({ tenantId: z.string().uuid() });

/** Per-subject payload schemas. */
export const SubjectPayloads = {
  [Subjects.DocsUploaded]: TenantPayload.extend({
    docId: z.string().uuid(),
    s3Key: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
  }),
  [Subjects.DocsExtracted]: TenantPayload.extend({
    docId: z.string().uuid(),
    extractedSnapshot: z.unknown(),
  }),
  [Subjects.PyramidRequested]: TenantPayload.extend({
    requestId: z.string().uuid(),
    targetFrameworks: z.array(z.string()),
    inputDocIds: z.array(z.string().uuid()),
  }),
  [Subjects.PyramidGenerated]: TenantPayload.extend({
    pyramidId: z.string().uuid(),
    versionId: z.string().uuid(),
    contentHash: z.string(),
  }),
  [Subjects.PyramidMutations]: TenantPayload.extend({
    pyramidId: z.string().uuid(),
    mutationId: z.string().uuid(),
    payload: z.unknown(),
  }),
  [Subjects.PyramidProgress]: TenantPayload.extend({
    requestId: z.string().uuid(),
    phase: z.string(),
    step: z.number().int(),
    total: z.number().int(),
    message: z.string().optional(),
  }),
  [Subjects.CompilerRequested]: TenantPayload.extend({
    intentId: z.string().uuid(),
    targets: z.array(
      z.enum([
        "rego",
        "ansible",
        "kyverno",
        "cis",
        "aws_config",
        "azure_policy",
        "scaleway_iam",
        "gcp_org_policy",
        "falco",
      ]),
    ),
  }),
  [Subjects.CompilerCompleted]: TenantPayload.extend({
    intentId: z.string().uuid(),
    artifactIds: z.array(z.string().uuid()),
    status: z.enum(["fresh", "stale", "failed"]),
  }),
  [Subjects.AuditEvents]: TenantPayload.extend({
    source: z.string(),
    kind: z.string(),
    payload: z.unknown(),
  }),
  [Subjects.ComplianceFindings]: TenantPayload.extend({
    severity: z.enum(["error", "warn", "info"]),
    finding: z.unknown(),
  }),
  [Subjects.GovernanceActions]: TenantPayload.extend({
    kind: z.enum([
      "ansible_apply",
      "directive_signature",
      "artifact_publication",
      "rule_exception",
      "production_mutation",
    ]),
    subjectRef: z.string(),
    decision: z.enum(["approved", "rejected"]).optional(),
  }),
  [Subjects.LlmCalls]: TenantPayload.extend({
    provider: z.string(),
    model: z.string(),
    taskType: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estCostMicroUsd: z.number().int().nonnegative(),
    success: z.boolean(),
  }),
  [Subjects.Dlq]: z.object({
    originalSubject: z.string(),
    payload: z.unknown(),
    error: z.string(),
    deliveryCount: z.number().int(),
  }),
} satisfies Record<EgideSubject, z.ZodType>;

export function isEgideSubject(subject: string): subject is EgideSubject {
  return subject.startsWith("egide.v1.");
}

/** Parse a subject string and return its components. */
export function parseSubject(subject: string): {
  domain: string;
  action: string;
  version: string;
} | null {
  const match = subject.match(/^egide\.(v\d+)\.([^.]+)\.(.+)$/);
  if (!match) return null;
  return { version: match[1] ?? "", domain: match[2] ?? "", action: match[3] ?? "" };
}
