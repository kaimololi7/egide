# Egide — Architecture

This document describes the runtime architecture of Egide, its data flows, and
the contract between components. ADRs in `adr/` capture the **why**; this
document captures the **what** and **how**.

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
- Adds RDF + SHACL evaluation when the tenant enables it (Professional+).
- Returns a `ValidationReport` with errors and warnings.
- Exposed via gRPC and called by the API on every pyramid mutation.

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

### `agents/common` (Python)

- Ported `BaseAgent` from `aegis-platform`.
- Adapter to `packages/llm-router`: a `LLMClient` that POSTs to the API gateway
  rather than calling Anthropic directly. Centralizes provider choice and audit.
- Provides circuit breaker, retry with exponential backoff, structured logging.

### `agents/compliance` (Python)

- Real implementation (replacing the empty `aegis-platform` stub).
- Tasks: gap analysis vs framework, SoA generation, control mapping,
  redundancy detection in dropped documents (J1).

### `agents/orchestrator` (Python)

- Multi-step pyramid generation: directive → policies → procedures → BPMN → KPI.
- Each step validates with `services/validator` before proceeding.
- Falls back to deterministic templates if `EGIDE_AI_MODE=template_only`.

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
| PostgreSQL 17 | Operational data: tenants, users, pyramids, RBAC | ACID, well-known, sovereign-friendly (PG is everywhere) |
| ClickHouse | Audit trail, telemetry, KPI history | 10–100× faster than PG for time-series; reused from `aegis-platform` |
| S3-compatible | Evidence blobs (PDFs, OSCAL exports, signed snapshots) | MinIO for on-prem, Scaleway/OVH for sovereign cloud |
| Redis | Queues, LLM response cache, sessions | Standard caching layer |

### Event bus (deferred, from M5+)

When agents and pipeline volume grows, introduce **NATS JetStream** (chosen over
Kafka/Redpanda for simpler ops in mid-market on-prem). Subjects:

- `egide.pyramid.mutations` — every artifact change
- `egide.audit.events` — events from agents and integrations
- `egide.compliance.findings` — drift, gaps, alerts
- `egide.compiler.results` — compilation outcomes
- `egide.governance.actions` — directive signatures, approvals, exceptions

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
   - `services/compiler` recompiles affected artifacts.
3. Persists the new version with parent hash, so audit trail is verifiable.
4. Publishes mutation to `egide.pyramid.mutations` for any subscribers.

This is the most expensive operation; LLM-as-judge is opt-in to keep p95 latency
under 5 seconds for non-AI mutations.
