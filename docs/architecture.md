# Egide — Architecture

This document describes the runtime architecture of Egide, its data flows, and
the contract between components. ADRs in `adr/` capture the **why**; this
document captures the **what** and **how**.

> **Last update**: 2026-05-05. Reflects ADR 006 (graph), 007 (RAG), 008
> (queue), 011 (agent strategy), 012 (terminology), 013 (persona).
>
> **Vocabulary** (cf. ADR 012): "agent" = `edge/agent` Go binary on customer
> hosts ; "AI worker" = Python process running an LLM agent loop in
> `agents/*` ; "collector" = third-party API adapter in
> `services/pipeline/connectors/`.

## High-level diagram

```
                            ┌────────────────────────────────────┐
                            │  Web (Next.js 15, RSC + Server     │
                            │  Actions, shadcn/ui)               │
                            └──────────────┬─────────────────────┘
                                           │ tRPC
                            ┌──────────────▼──────────────────────┐
                            │  API Gateway                         │
                            │  Bun + Hono + tRPC                   │
                            │  - auth, multi-tenant                │
                            │  - LLM Router (per-tenant config)    │
                            │  - orchestration                     │
                            └──┬───────┬───────┬───────┬─────────┬─┘
                               │       │       │       │         │
       ┌───────────────────────┘       │       │       │         └───────────────┐
       │                               │       │       │                         │
┌──────▼───────┐  ┌──────────────┐  ┌─▼───┐  ┌─▼─────┐  ┌──────────────────────┐ │
│ Extractor    │  │ Validator    │  │Comp-│  │Pipeli-│  │ Edge Gateway         │ │
│ (Python)     │  │ (Go)         │  │iler │  │ne     │  │ (Go) — mTLS to       │ │
│ Unstructured │  │ 25 rules +   │  │(Go) │  │(Go)   │  │ tenant agents        │ │
│ Docling      │  │ LLM-as-judge │  │ TAI │  │ logs  │  │                      │ │
│ pypdf        │  │ optional     │  │ →   │  │ pars- │  └──────────┬───────────┘ │
└──────┬───────┘  └──────┬───────┘  │ Rego│  │ ers   │             │             │
       │                  │          │ Ans-│  │       │             │             │
       │                  │          │ ible│  └───┬───┘             │             │
       │                  │          │ ... │      │                 │             │
       │                  │          └─────┘      │                 ▼             │
       │                  │                        │       ┌──────────────────┐  │
       │                  │                        │       │ Edge Agent       │  │
       │                  │                        │       │ (Go binary)      │  │
       │                  │                        │       │ - Linux/Win/Mac  │  │
       │                  │                        │       │ - Proxmox-aware  │  │
       │                  │                        │       │ - posture audit  │  │
       │                  │                        │       └──────────────────┘  │
       │                  │                        │                              │
       └──────────┬───────┴────────────────────────┴──────────────────────────────┘
                  │
                  ▼
       ┌────────────────────────────────────────────────────────────────────────┐
       │  Persistence                                                            │
       │  - PostgreSQL    (operational: tenants, users, pyramid versions, RBAC) │
       │  - ClickHouse    (audit trail, evidence telemetry, KPI history)         │
       │  - S3-compatible (evidence blobs: signed PDFs, OSCAL exports)           │
       │  - Redis         (queues, LLM cache, sessions)                          │
       └────────────────────────────────────────────────────────────────────────┘

       ┌────────────────────────────────────────────────────────────────────────┐
       │  AI Agents (Python, optional — disabled in template_only mode)         │
       │  - common: BaseAgent + CircuitBreaker + LLM router client              │
       │  - compliance: gap analysis, SoA generation, framework mapping         │
       │  - orchestrator: multi-step pyramid generation workflows               │
       │  Communicate via NATS subjects with API gateway                        │
       └────────────────────────────────────────────────────────────────────────┘
```

## Components

### `apps/web` (TypeScript)

- Next.js 15 App Router with React Server Components and Server Actions.
- shadcn/ui + Tailwind v4.
- Routes: marketing landing, app dashboard, pyramid editor, BPMN viewer
  (bpmn-js read-only at MVP), policy compiler viewer, evidence browser,
  audit-readiness checklist, auditor read-only view.
- Talks to the API via tRPC.

### `apps/api` (TypeScript, Bun + Hono)

- Single entry point for the web app and external integrations.
- Hosts the **LLM Router** (`packages/llm-router`) that abstracts provider choice.
- Authenticates via Supabase (Community/Pro) or SAML/OIDC (Enterprise).
- Multi-tenant boundary: every tRPC procedure validates tenant membership.
- Orchestrates Go and Python services via HTTP/gRPC and NATS.

### `services/validator` (Go)

- Ports the 25 deterministic rules from `process-pyramid` to native Go.
- Reads the pyramid graph from PG via `pgx` and recursive CTE queries
  (cf. ADR 006). No graph DB at MVP.
- Returns a `ValidationReport` with errors and warnings.
- Exposed via gRPC and called by the API on every pyramid mutation.
- SHACL is **post-MVP** (ADR 003 amended). When a Pro+ customer demands
  W3C SHACL, a pyshacl Python sidecar is added.

### `services/compiler` (Go) — **the moat**

- Implements ADR 005 (multi-target Policy-as-Code).
- Accepts a Target-agnostic Intent (TAI) and a target list, returns artifacts.
- Generators per target are Go packages (`generators/rego`, `generators/ansible`, ...).
- Exposes test runners that exercise each artifact against canned fixtures.
- Versions and (Enterprise) signs artifacts with tenant Ed25519 keys.

### `services/pipeline` (Go)

- Reuses `aegis-platform` parsers (syslog, JSON, Windows Event XML, CEF).
- Refactored: drops Sigma rules and SOC-specific normalizations.
- Adds a "control event" enrichment layer: each parsed event tagged with
  governance context (asset → owner → control → policy → directive).
- Publishes to NATS subject `egide.audit.events`.

### `services/datalake` (Go)

- ClickHouse client adapted from `aegis-platform`.
- Schema: events, audit_log, evidence, kpi_history, pyramid_versions.
- Query API for the auditor view (J5) and continuous compliance dashboard (J4).

### `services/extractor` (Python)

- Stateless microservice exposing `POST /extract` with multipart upload.
- Wraps **Unstructured** (advanced PDF/Word/HTML) and **Docling** (IBM,
  layout-preserving) and **pypdf** (fallback).
- Returns a structured JSON of sections, tables, references; downstream
  agents do the GRC mapping.

### `agents/common` (Python AI worker shared library)

- **PydanticAI + Instructor** as agent framework (cf. ADR 011).
- Custom `CircuitBreaker` ported from `aegis-platform` for provider failure isolation.
- `LLMClient` adapter: POSTs to `apps/api` LLM Router or reads NATS subjects
  for streamed embed batches.
- Audit trail wrapper writes every call to `llm_calls` (tenant_id, pyramid_id,
  journey_phase, worker_name, cache_hit).
- Hallucination guard: post-processes any tool output containing anchor
  strings against `ontology_chunks.anchor_ref`.

### `agents/compliance` (Python AI worker — multi-step super-agent)

- One PydanticAI `Agent` with ~10 internal **tools** (cf. ADR 011 Strategy B):
  `search_anchors`, `classify_chunk`, `draft_policy`, `draft_procedure`,
  `draft_bpmn`, `draft_kpi`, `gap_analysis`, `validate`, `judge_coherence`,
  `propose_fix`.
- Each tool is a typed Python function ; tested in isolation and end-to-end
  via the eval framework (ADR 009).
- Per-tool routing profile (`extraction`, `classification`, `generation`,
  `judge`, `synthesis`) drives provider selection in the LLM Router.

### `agents/orchestrator` (Python deterministic workflow runner)

- **Plain Python state machine**, NOT a PydanticAI agent (orchestration is
  deterministic, not LLM-driven).
- Listens on NATS subjects (`egide.docs.uploaded`, `egide.pyramid.requested`,
  …), drives the multi-phase J1 workflow, calls `agents/compliance` tools or
  the validator/compiler as needed.
- Falls back to deterministic templates seeded from
  `ontologies/clusters/*.yaml` if `EGIDE_AI_MODE=template_only`.
- Streams progress events back via NATS (`egide.pyramid.progress`) for the
  web UI to render.

### `edge/agent` (Go)

- Cross-platform single binary; mTLS to `edge-gateway`.
- Collectors: OS posture (encryption, MFA on machine accounts, patch level,
  AV/EDR presence), Proxmox node state via API token, Ansible inventory
  reflection.
- Reports periodically and on-event.

### `packages/db` (TypeScript, Drizzle)

- Schema ported from `process-pyramid/packages/db`.
- Tables: tenants, users, pyramids, pyramid_versions, artifacts, evidence,
  audit_log, license_keys, llm_calls.

### `packages/llm-router` (TypeScript)

- Implements ADR 004.
- Provider implementations: Anthropic, Mistral, Scaleway AI, OVH AI,
  OpenAI-compatible, Ollama, vLLM, LM Studio.

### `packages/policy-targets` (TypeScript)

- TypeScript types for the TAI Intent IR and per-target artifact shapes.
- Consumed by the web UI to render compiler output without re-parsing.

### `packages/oscal` (TypeScript)

- TS types for OSCAL JSON at the API boundary; Go side handles serialization.

### Persistence

| Store | Role | Why |
|---|---|---|
| PostgreSQL 17 + `pgvector` + (Pro+ optional) AGE | Operational data, pyramid graph (recursive CTE + JSONB cf. ADR 006), normative RAG (cf. ADR 007) | One store; sovereign-friendly; air-gapped capable |
| ClickHouse | Audit trail, telemetry, KPI history | 10–100× faster than PG for time-series; reused from `aegis-platform` |
| S3-compatible | Evidence blobs (PDFs, OSCAL exports, signed snapshots) | MinIO for on-prem, Scaleway/OVH for sovereign cloud |
| Redis | LLM response cache, sessions, short TTL state | Standard caching layer (NATS handles queues — see below) |

### RAG normative layer (cf. ADR 007)

- `ontology_chunks` table in PG holds chunked cluster YAMLs with two
  embedding columns (Mistral 1024-dim, nomic 768-dim).
- HNSW indexes on each embedding column.
- Wrapped by a thin `apps/api/src/rag/` module — not a separate service.
- Used by `agents/compliance` tools (`search_anchors`) and by the
  hallucination guard (Q01).

### Event bus: NATS JetStream from M1 (cf. ADR 008)

NATS JetStream is the single message bus from sprint S1 — it is **not**
deferred to M5+. Cross-language native (TS + Python + Go), single binary,
~30 MB RAM, Apache 2.0.

Subjects (prefix `egide.`):

- `egide.docs.uploaded` / `egide.docs.extracted`
- `egide.pyramid.requested` / `egide.pyramid.generated` / `egide.pyramid.mutations` / `egide.pyramid.progress`
- `egide.compiler.requested` / `egide.compiler.completed`
- `egide.audit.events`
- `egide.compliance.findings`
- `egide.governance.actions` (approvals, signatures)
- `egide.llm.calls` (audit fan-out)
- `egide.dlq` (failed handlers after MaxDeliver)

Streams: `JOBS` (work queue, ack), `EVENTS` (replayable 7d), `FINDINGS`
(replayable 30d).

## Multi-tenancy

- **Tenant column** on every operational table; row-level security in PG.
- **Tenant header** required on every API call; verified server-side.
- **Tenant prefix** on every ClickHouse query.
- **Tenant signing key** (Ed25519) for Enterprise edition signs every artifact.

## Security boundaries

1. **Edge agents** authenticate with mTLS using a tenant-scoped certificate.
2. **API gateway** is the only public surface; no service is exposed externally.
3. **Service-to-service** uses internal-network HTTP; mTLS enabled in production.
4. **LLM calls** never see customer secrets (we strip before prompt assembly).
5. **Evidence storage** uses tenant-encrypted S3 keys (KMS or local key file).

## Deployments

- **Community / Professional**: Docker Compose dev; Kubernetes (Helm) prod;
  Scaleway / OVH for sovereign cloud.
- **Enterprise air-gapped**: Proxmox VM image bundle + offline package
  repository for updates. The bundle includes Mistral 7B / Qwen 14B
  pre-quantified models so the Customer has working LLM out of the box.

## Coherence cascade (the headline feature)

When an artifact mutates, the API gateway:

1. Calls `services/validator` with the mutated pyramid.
2. If valid, propagates implications:
   - Children inherit numerical commitments and SLAs (downward).
   - Parent re-validation is triggered (upward).
   - Compiled policies referencing affected nodes are marked `stale`.
   - `services/compiler` recompiles affected artifacts (queued via NATS).
3. Persists the new version with parent hash, so audit trail is verifiable.
4. Publishes mutation to `egide.pyramid.mutations` for any subscribers.

This is the most expensive operation; LLM-as-judge is opt-in to keep p95 latency
under 5 seconds for non-AI mutations.

## Long-running journeys: streaming UX

J1 (drop docs → pyramide) takes 5–15 minutes. The web UI does not block:

1. Web → API → publish `egide.pyramid.requested`.
2. `agents/orchestrator` consumes, drives the workflow.
3. Each phase emits `egide.pyramid.progress` with `{ phase, step, total, payload }`.
4. API streams progress to the web client via Server-Sent Events.
5. UI renders a live timeline ("phase 3/7 — analyzing control A.5.24").

Same pattern for compiler runs, audit exports, and bulk imports.

## CLI as a first-class interface (cf. ADR 013)

The MVP persona is technical. `apps/cli/` (TypeScript, Bun-built single
binary) ships in M1 alongside the web UI. Every action available in both:

```bash
egide pyramid generate --frameworks iso27001,nis2 --input docs/
egide pyramid validate <pyramid-id>
egide compile rego <intent-id> --output bundles/
egide approval list --pending
egide ontology reindex
```

The CLI calls the same tRPC API as the web. Documentation treats it as a
primary interface, not a power-user feature.
