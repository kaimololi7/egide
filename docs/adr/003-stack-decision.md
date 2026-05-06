# ADR 003 — Stack decision: TypeScript + Go + Python, isolated per service

- **Status**: Accepted (amended 2026-05-05)
- **Date**: 2026-05-04
- **Deciders**: solo founder
- **Amendments**: see "Updates 2026-05-05" at the bottom

## Context

The product spans:

- A web UI (rich, interactive, multi-tenant)
- An API gateway (fast, type-safe, multi-tenant orchestration)
- A deterministic validator (25+ rules, must run anywhere)
- A multi-target policy compiler (the moat — Rego, Kyverno, Ansible, CIS, cloud-policy)
- A document extractor (PDF / Word / Markdown → structured pyramid input)
- A multi-LLM router (Anthropic, Mistral, Scaleway, OVH, Ollama, vLLM)
- A pipeline ingesting telemetry from edge agents
- A datalake for audit/evidence
- A cross-platform edge agent
- AI agents performing extraction, classification, judgment, generation

The candidate languages are:

| Language | Strengths | Weaknesses |
|---|---|---|
| TypeScript | Web ecosystem, RSC, type-safety end-to-end via tRPC | Less suited to system services, HTTP servers in long-lived processes are common but not always ideal |
| Go | Native to OPA / Conftest / Kyverno / cloud-native; cross-platform binaries; performance; idiomatic for agents and pipelines | Longer ramp-up if not familiar; less rich for ML/LLM SDK |
| Python | Best-in-class for LLM (Anthropic, Mistral SDKs are Python-first), document parsing (Unstructured / Docling / pypdf), data science | Slower runtime; deployment heavier; not ideal for cross-platform binaries |
| Rust | Performance + safety + WASM | Steeper learning curve; smaller ecosystem for LLM and OPA |

A monolingual stack would minimize cognitive load for a solo developer but would
break domain fit at multiple points:

- **OPA / Kyverno SDKs are Go**. Reimplementing in TS or Python is fragile and
  loses the official AST manipulation libraries.
- **Document parsing for J1** depends on Python libraries (Unstructured, Docling)
  that have no production-grade equivalent in TS or Go.
- **Edge agents** are best in Go (osquery precedent, single static binary,
  cross-platform, mTLS-ready).

## Decision

We accept **three languages**, with **strict domain isolation**: each service
is single-language, no FFI, communication via HTTP/gRPC/Kafka.

| Component | Language | Rationale |
|---|---|---|
| `apps/web` | TypeScript (Next.js 15) | Web ecosystem, RSC, shadcn/ui; existing skill |
| `apps/api` | TypeScript (Bun + Hono + tRPC) | Type-safe contracts shared with web; orchestration layer; Bun for cold-start speed and DX |
| `services/validator` | Go | Performance; runs the 25-rule deterministic engine; ported from `process-pyramid` Python |
| `services/compiler` | Go | **The moat**. OPA SDK and Conftest are Go-native; Rego AST manipulation requires it; same binary easily targets Kyverno templates and Ansible YAML |
| `services/pipeline` | Go | Reuse the `aegis-platform` parsers (syslog, JSON, WinEvent, CEF); high-throughput message processing |
| `services/datalake` | Go | ClickHouse client; reuse `aegis-platform` schema and queries |
| `services/extractor` | Python | Unstructured / Docling / pypdf are Python-only; isolated microservice with HTTP/gRPC interface |
| `agents/common` | Python | `BaseAgent` + Anthropic / Mistral / Ollama SDKs are Python-first; ported from `aegis-platform` |
| `agents/compliance` | Python | Same agent framework |
| `agents/orchestrator` | Python | Same agent framework |
| `edge/agent` | Go | Cross-platform single binary; reuse `aegis-platform` skeleton |
| `packages/db` | TypeScript (Drizzle) | TS code accessing Postgres; reuse `process-pyramid` schema |
| `packages/llm-router` | TypeScript | Adapter pattern called by `apps/api`; provider abstraction |
| `packages/policy-targets` | TypeScript | Type definitions for policy artifacts (consumed by web and API); Go services produce the artifacts |
| `packages/oscal` | TypeScript | TS types for the API boundary; serializer in Go |

### Communication contracts

- **Web ↔ API**: tRPC (TypeScript end-to-end types).
- **API ↔ Go services**: HTTP + protobuf for synchronous calls, NATS / Kafka
  topics for async.
- **API ↔ Python services**: HTTP + JSON Schema; LLM streaming via SSE.
- **Edge agent ↔ pipeline**: gRPC over mTLS.

### Tooling

- **Package management**: `pnpm` (TS), `go mod` + `go.work` (Go), `uv` (Python).
- **Linting**: `biome` (TS), `golangci-lint` (Go), `ruff` + `mypy --strict` (Python).
- **Testing**: `vitest` (TS), `go test` + `testify` (Go), `pytest` (Python).
- **Build orchestration**: `turbo` for TS workspace; `make` per Go/Python service.
- **CI**: GitHub Actions matrix per language; `pre-commit` enforces lint locally.

## Consequences

- The repository is a monorepo but **multi-runtime**. Each top-level service
  has its own Dockerfile and is independently deployable.
- Cognitive overhead exists but is bounded: each domain has a stable language
  choice and we never mix.
- The **policy compiler in Go** is the structural reason we are not pure-TS.
  This is non-negotiable: OPA / Conftest / Kyverno tooling assumes Go.
- The **doc extractor in Python** is the structural reason we are not pure-Go.
  Equivalent libraries do not exist outside Python.
- Future contributors to the open-source community will need familiarity with
  whichever service domain they touch. We document language choice in each
  service's README.
- We commit to **not adding a fourth language** without an ADR amendment.
  Specifically, no Rust, Elixir, or Java unless there is a demonstrated necessity.

## Updates 2026-05-05

### SHACL is post-MVP

The original ADR implied we would run SHACL validation in `services/validator`
(Go). After analysis: pyshacl (Python) is the only mature SHACL runtime ; no
production-grade Go SHACL exists. Two paths were possible:

- Add a Python sidecar = violates the per-service isolation principle.
- Reimplement SHACL in Go = months of work for negligible benefit at MVP.

We adopt a third path: **SHACL is post-MVP**. The 25 deterministic coherence
rules are ported as Go validators using PostgreSQL recursive CTE queries
(see ADR 006). When a customer demands W3C-standard SHACL validation as
Pro+, we deploy a pyshacl sidecar then.

The skill `.claude/skills/shacl-validation.md` is preserved for reference
but tagged "post-MVP".

### Auth choice clarified

ADR 003 mentioned Supabase as a possible auth choice ; for the MVP persona
(technical, sovereign-friendly), we standardize on:

- **Better-Auth** (TypeScript library in `apps/api`) for Community + Pro.
  Zero external service to operate.
- **Authentik** (self-hosted FOSS) for Enterprise SAML/OIDC/SCIM.
- Supabase remains an option for hosters who prefer it ; not the default.

### Container builds

Adopted: **ko** (Go images without Dockerfile, distroless), **distroless**
base for TS and Python services. Image footprint discipline matters for
air-gapped Enterprise bundle (Proxmox VM constraint).

### Local cluster dev

Adopted: **k3d** for Helm chart testing. Lightweight, Docker-backed, no
DigitalOcean / GKE roundtrip in CI.
