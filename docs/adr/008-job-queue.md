# ADR 008 — Job queue and event bus: NATS JetStream from M1

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder
- **Amends**: ADR architecture.md "deferred to M5+" → adopted from M1

## Context

Several MVP-scope operations cannot be synchronous HTTP calls:

- **J1 — drop docs**: extraction + classification + pyramid generation
  takes 5–15 minutes. Cannot block an HTTP request.
- **Compiler runs**: each Intent compiled to N targets, each target tested
  against fixtures via `opa eval` / `kyverno apply`. Seconds to minutes.
- **Continuous compliance (J4, M5+)**: telemetry from edge agents and
  cloud connectors flows continuously, must fan-out to handlers.
- **Cross-language workers**: API is TypeScript; AI workers are Python;
  validator and compiler are Go. They need a transport that all three speak.

## Decision

### NATS JetStream as the single message bus from M1

NATS JetStream replaces the architecture's "deferred to M5+" stance. It
is installed in Docker Compose dev and Helm prod from sprint S1.

| Option | Verdict |
|---|---|
| **NATS JetStream** | ✅ Native clients TS + Python + Go ; durable streams ; pull consumers ; lightweight (single binary, ~30 MB RAM) ; Apache 2.0 |
| BullMQ | ❌ TS-only; Python BullMQ-py immature; would force HTTP glue between API and Python workers |
| Temporal | ❌ Excellent but DB + server + UI to operate; overkill solo; air-gapped deployment burden |
| River (Go) | ❌ Postgres-backed but Go-only client; would exclude Python workers |
| Celery | ❌ Python-only consumer side; would force HTTP glue between API and Python |
| Kafka / Redpanda | ❌ Heavy ops, JVM or wide footprint; overkill for mid-market on-prem |
| pg_listen/notify | ❌ Works for 1-1 but no fan-out, no replay, no DLQ |

### Subjects

```
egide.docs.uploaded         tenant_id, doc_id, s3_key
egide.docs.extracted        tenant_id, doc_id, extracted_payload
egide.pyramid.requested     tenant_id, request_id, target_frameworks
egide.pyramid.generated     tenant_id, pyramid_id, version_id
egide.pyramid.mutations     tenant_id, pyramid_id, mutation_payload
egide.compiler.requested    tenant_id, intent_id, targets[]
egide.compiler.completed    tenant_id, artifact_id, status
egide.audit.events          tenant_id, source, event
egide.compliance.findings   tenant_id, severity, finding
egide.governance.actions    tenant_id, kind, action
egide.llm.calls             tenant_id, provider, tokens, cost (audit fan-out)
```

All subjects start with `egide.`. Each domain has its own JetStream stream
with retention/replay policy.

### Stream policies

| Stream | Retention | Replicas | Notes |
|---|---|---|---|
| `JOBS` (subjects: `egide.*.requested`) | WorkQueue, ack-based | 1 dev / 3 prod | DLQ for failed handlers |
| `EVENTS` (subjects: `egide.*.completed`, `egide.*.mutations`, `egide.audit.*`) | Limits 7d / 1 GB | 1 dev / 3 prod | Replayable for audit |
| `FINDINGS` (subjects: `egide.compliance.findings`) | Limits 30d | 1 dev / 3 prod | Drives J4 dashboard |

### Client libraries

| Language | Client |
|---|---|
| TypeScript (`apps/api`) | `nats.ws` or `nats` (official) |
| Python (`agents/*`, `services/extractor`) | `nats-py` (official) |
| Go (`services/*`, `edge/agent`) | `nats.go` (official) |

All three are first-party Synadia maintained.

### Operational footprint

- **Dev**: 1 NATS container in `deploy/docker/compose.yaml`. ~30 MB RAM.
- **Prod**: NATS StatefulSet in Helm chart, 3 replicas, JetStream enabled,
  PVC for storage.
- **Air-gapped Enterprise**: bundled in Proxmox VM image. Single binary.

### Failure modes and DLQ

Every consumer specifies `MaxDeliver` (default 5) and an `egide.dlq` subject
for messages exceeding retries. The DLQ has a manual retry CLI tool
(`egide jobs replay <subject> <since>`).

## Consequences

- `deploy/docker/compose.yaml` includes NATS from S1.
- `packages/messaging/` (TS) wraps NATS client with typed payloads.
- Python `agents/common/` adds `nats_client.py` for AI workers.
- Go services use `nats.go` directly.
- All async operations use NATS subjects from day one. No `setTimeout`
  polling, no `pg_listen` hacks.
- The architecture diagram is updated: NATS bus is shown from M1, not
  marked "deferred".

## Open questions

- Do we expose NATS subjects as a public API for partner integrations
  (J7 cabinet console)? Probably yes M9+ via NATS leaf nodes; not MVP.
- Encryption in transit: NATS supports TLS natively. Required in prod;
  optional in dev.
