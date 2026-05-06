# ADR 010 — Approval workflow primitives

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder

## Context

Two journeys require human approval before action:

- **J9 (apply Ansible real)**: a generated Ansible playbook should not
  modify a production server without an explicit authorization trail.
- **J6 (strategic→executable cascade)**: a directive from the DG must be
  formally signed before cascading downward.

Other future flows: artifact publication (J5 auditor sign-off), policy
mutation in production (sensitive change), exception management (waiver
on a failing rule).

A workflow engine (Temporal, Camunda) is overkill for this scope: we need
a state machine, signatures, audit trail, and notifications — not a
business process orchestrator.

## Decision

### Schema

Add to `packages/db/src/schema.ts`:

```ts
export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  kind: text("kind", {
    enum: [
      "ansible_apply",
      "directive_signature",
      "artifact_publication",
      "rule_exception",
      "production_mutation",
    ],
  }).notNull(),
  // What is being approved (intent_id, mutation_id, directive_id, etc.)
  subjectRef: text("subject_ref").notNull(),
  subjectHash: text("subject_hash").notNull(),  // bind to the exact payload at request time
  status: text("status", {
    enum: ["pending", "approved", "rejected", "expired", "cancelled"],
  }).notNull().default("pending"),
  // Required approver count (1 for Pro, configurable for Enterprise)
  requiredApprovals: integer("required_approvals").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  requestedBy: uuid("requested_by").notNull().references(() => users.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvalSignatures = pgTable("approval_signatures", {
  id: uuid("id").defaultRandom().primaryKey(),
  approvalRequestId: uuid("approval_request_id").notNull()
    .references(() => approvalRequests.id, { onDelete: "cascade" }),
  approverId: uuid("approver_id").notNull().references(() => users.id),
  decision: text("decision", { enum: ["approve", "reject"] }).notNull(),
  comment: text("comment"),
  // Ed25519 signature of (approval_request.subjectHash + decision + approver_id + timestamp)
  signature: text("signature").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### State machine

```
pending ──approve──▶ approved (when signatures.count == requiredApprovals)
        ──reject───▶ rejected (any approver rejects)
        ──expire───▶ expired (cron sweeps after expiresAt)
        ──cancel───▶ cancelled (requester withdraws)
```

Once `approved`, a NATS event `egide.governance.actions` is emitted
carrying `subjectRef` and the consumer (Ansible runner, signature cascade,
publication pipeline) acts on it.

### Signature crypto

- Each user has an **Ed25519 keypair** generated at first login (stored
  encrypted client-side in Pro+ via WebAuthn-backed key wrap; server-side
  in Community for simplicity).
- The signature payload is canonical JSON of
  `{ subjectHash, decision, approverId, signedAt }`.
- Public keys per user are stored in `users.public_key`; the API verifies
  signatures on every approval insert.
- Enterprise: signatures additionally chained into `evidence_blobs` for
  hash-chain audit trail.

### UX (technical persona)

The persona is **technical** — a CLI is first-class:

```bash
egide approval list --pending
egide approval show <id>
egide approval approve <id> --comment "Verified the Ansible diff in CI run #4521"
egide approval reject <id> --comment "Missing rollback test"
```

Web UI is a thin wrapper around the same operations.

### Notifications

On request creation: NATS `egide.governance.actions` → consumers (email,
Slack, Teams) deliver to assigned approvers.

### Why NOT Temporal

Temporal is the right tool for orchestrating cross-service stateful
workflows (saga pattern, compensations, long-running ETL). For "wait for
N humans to click approve" it is over-engineering. A state machine in PG
+ NATS event suffices.

## Consequences

- New tables added to Drizzle schema in M2 sprint.
- `apps/api` exposes tRPC routes `approval.request`, `approval.sign`,
  `approval.list`, `approval.cancel`.
- Each approver-relevant journey (J6, J9) creates an `approval_request`
  before acting and waits on `egide.governance.actions`.
- CLI `egide approval` subcommand added in `apps/cli/` (a thin TS wrapper
  on the API).
- An `approvals.expire` cron sweeps every 5 min via NATS scheduled
  consumer.

## Open questions

- Multi-step approval (sequential approvers, escalation)? Defer to M11+
  Enterprise. Keep simple parallel "M of N" model in MVP.
- WebAuthn-bound signatures vs server-stored keys: WebAuthn nicer but
  requires HTTPS-bound origin. Default to server-stored encrypted in
  Community/Pro; offer WebAuthn in Enterprise.
