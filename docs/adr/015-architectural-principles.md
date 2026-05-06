# ADR 015 — Architectural principles: hexagonal selective + DDD + 12-factor

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder
- **Foundation for**: ADR 014 (security by design), ADR 016 (secure SDLC)

## Context

Egide is a multi-service monorepo (TS + Go + Python) that must remain
**evolvable** (adding new policy compiler targets, new collectors, new
frameworks must not require core rewrites) and **maintainable** by a
solo developer.

Without explicit architectural patterns, code drifts toward "everything
calls everything", tests become impossible, and refactoring is
prohibitive. With overly strict patterns (hexagonal everywhere, DDD on
trivial CRUD), velocity dies.

## Decision

### Hexagonal architecture — selective application

Strict hexagonal (ports & adapters with explicit domain/application/
infrastructure layers) on **two services where the metier complexity and
testability matter most**:

| Service | Why strict hexagonal |
|---|---|
| `services/validator` (Go) | Core business logic = 25 coherence rules + LLM-judge. Must be testable without a database. Future SHACL sidecar plugs as adapter. |
| `services/compiler` (Go) | The moat. Each generator is an adapter implementing the same `Generator` port. Future targets (Kyverno, AWS Config, Falco) must add as packages without touching the core. |

Layer convention (Go):

```
services/<svc>/
├── internal/
│   ├── domain/          # entities, value objects, domain services
│   ├── application/     # use cases (orchestration of domain operations)
│   ├── ports/           # interfaces consumed by application
│   └── infrastructure/  # adapters: db, llm, http, nats, file system
├── cmd/
│   └── server/main.go   # composition root
└── api/                 # external API definitions (proto, openapi)
```

The composition root in `cmd/` wires concrete adapters to ports. No
package outside `infrastructure/` imports a third-party library
(database driver, NATS client, OPA SDK, etc.). The domain is pure Go.

### Light ports & adapters on TypeScript and Python services

| Service | Pattern |
|---|---|
| `apps/api` (TS) | tRPC routers per bounded context ; service layer ; repository interfaces with Drizzle adapter ; no fat controllers |
| `services/extractor` (Python) | FastAPI thin layer ; one extractor port (`Extractor` ABC) with adapters per format (Docling, pypdf, MarkItDown) ; no business logic in handlers |
| `agents/*` (Python) | PydanticAI Agent + tools (cf. ADR 011) ; tools are pure functions ; LLM calls through the `LLMClient` adapter (ports/) |

Avoid full hexagonal here — the cost outweighs the benefit at this scale.
Tests use the natural test seams: Drizzle test DB, Docling fixtures,
PydanticAI's built-in test runner.

### Next.js conventions on `apps/web`

`apps/web` follows **standard Next.js App Router conventions** (RSC +
Server Actions). Hexagonal does not graft well on the framework's data
fetching model. Instead:

- Server Actions call tRPC procedures (no direct DB or LLM access from web).
- Components are dumb (presentation), data fetching at boundaries (RSC).
- Shared UI primitives in `apps/web/src/components/ui/` (shadcn).
- Shared logic in `packages/*` workspaces.

### Domain-Driven Design — bounded contexts

Five bounded contexts with explicit boundaries:

| Bounded context | Owns | Lives in |
|---|---|---|
| **Pyramid** | Pyramid graph, versions, mutations, coherence | `services/validator` + `apps/api/src/contexts/pyramid` |
| **Compilation** | TAI Intent IR, generators, artifacts, tests | `services/compiler` + `apps/api/src/contexts/compilation` |
| **Compliance** | Document extraction, classification, gap analysis, SoA | `services/extractor` + `agents/compliance` + `apps/api/src/contexts/compliance` |
| **Audit** | Evidence blobs, audit logs, OSCAL exports, integrity chain | `services/datalake` + `apps/api/src/contexts/audit` |
| **Governance** | Directives, approvals, signatures, RBAC | `apps/api/src/contexts/governance` + (future J6 wizard) |

Cross-context calls go through **public APIs only** (NATS subjects, tRPC
procedures, gRPC endpoints). Direct cross-context imports are forbidden.
Anti-corruption layers translate between contexts at boundaries.

### 12-factor strict compliance

| Factor | How |
|---|---|
| Codebase | Single monorepo (`egide/`), versioned in git |
| Dependencies | Pinned exact (`pnpm` lockfile, `go.sum`, `uv.lock`) |
| Config | All via env vars, never committed (`.env.example` documented) |
| Backing services | NATS, PG, ClickHouse, Redis, S3, LLM providers — all via URL/config |
| Build, release, run | Strictly separate (CI builds, Helm releases, runtime runs) |
| Processes | Stateless; state in PG/Redis/S3/ClickHouse |
| Port binding | Each service binds its own port (`:8080`, `:9090`, …) |
| Concurrency | Horizontal scale per service; no shared in-memory state |
| Disposability | Fast startup (<5s), graceful shutdown (SIGTERM, drain queue) |
| Dev/prod parity | Docker Compose dev mirrors Helm prod ; same images |
| Logs | Stream to stdout, structured JSON ; collected externally (no log files) |
| Admin processes | One-shot CLI (`egide ontology reindex`, `egide migrate`) ; same codebase |

### API versioning

Every external API is versioned from v1:

- **tRPC** routers grouped: `appRouter.v1.pyramid.*`, `appRouter.v1.compilation.*`, etc.
- **REST** adapter (for non-TS clients) under `/api/v1/...`.
- **NATS subjects** include version: `egide.v1.pyramid.mutations`.
- **CLI commands** stable since v1; deprecation warnings before removal.
- **Intent IR JSON Schema** versioned at `https://egide.io/schema/tai-intent/v0.X.json`.

Breaking changes require a major version bump and a deprecation window
(minimum 6 months between vN and vN+1 EOL).

### Reversible migrations

Drizzle migrations: every `up.sql` ships with a `down.sql` tested in CI
(roll forward + roll back + roll forward). No "data lost on rollback"
warnings without explicit ADR amendment.

### Feature flags vs editions

Two distinct mechanisms:

- **Editions** (`EGIDE_EDITION` + signed license key) gate **commercial**
  features (Kyverno generator, air-gapped bundle, SAML/OIDC). Hard
  boundary, license-checked.
- **Feature flags** (table `feature_flags(tenant_id, flag_key, enabled)`)
  gate **per-tenant rollout** (e.g., a beta tool inside the AI worker, a
  new compiler optimization). Soft boundary, runtime toggle.

Never confuse the two. Editions are revenue-tied; flags are velocity-tied.

### Observability first-class

OpenTelemetry SDK in every service from M1, not added later:

- **Tracing**: trace_id propagated across HTTP, gRPC, NATS messages.
- **Metrics**: per-service `_total`, `_duration_seconds`, `_errors_total`
  with tenant_id label.
- **Logs**: structured JSON, trace_id auto-injected (`slog` Go,
  `structlog` Python, `pino` TS).

Backends: Jaeger / Tempo for traces, Prometheus + Grafana for metrics,
Loki for logs. Self-hostable, sovereign.

LLM-specific observability: Langfuse from Pro+ (cf. ADR 004 update).

### Repository pattern

Persistence access via **repository interfaces** in `ports/`, concrete
implementations in `infrastructure/`. Tests use in-memory or test-DB
implementations. No raw SQL inside use cases — only inside repository
adapters.

### Anti-corruption layer

When a context consumes another's API, **translate at the boundary**:

```python
# agents/compliance ingests data from services/extractor
@dataclass
class ExtractedDocument:  # local domain model
    sections: list[Section]
    metadata: DocMetadata

class ExtractorAdapter:  # anti-corruption layer
    async def fetch(self, doc_id: str) -> ExtractedDocument:
        raw = await self._http.get(f"/extract/{doc_id}")  # external DTO
        return self._translate(raw)  # → internal domain
```

Pydantic schemas at the boundary, internal dataclasses inside the
context. Never pass external DTOs into the domain.

### Idempotency

Every mutating endpoint accepts an `Idempotency-Key` header. Server
deduplicates on `(tenant_id, idempotency_key)` for 24h via Redis. Same
key + same body → same response. Same key + different body → 409.

CLI tools generate UUIDv7 idempotency keys per command invocation.

### Error taxonomy

A common error shape across all services and APIs:

```json
{
  "error": {
    "code": "PYRAMID_VALIDATION_FAILED",
    "message": "human-readable",
    "details": { "rule_id": "C01", "node_id": "..." },
    "trace_id": "...",
    "retryable": false,
    "documentation_url": "https://docs.egide.io/errors/PYRAMID_VALIDATION_FAILED"
  }
}
```

Codes are SCREAMING_SNAKE_CASE constants ; HTTP status follows RFC
semantics. Exhaustively typed in `packages/errors` (TS) and mirrored in
Go and Python.

### Retry policy

Default retry policy for transient errors: exponential backoff with
jitter, max 5 attempts, capped at 30s. Implemented once in
`packages/retry` (TS) and `agents/common/retry.py` (Python) and the Go
shared `libs/go/retry/`. Never reinvented per call site.

## Consequences

- The 5 bounded contexts are reflected in `apps/api/src/contexts/`
  directory structure from M1.
- `services/validator` and `services/compiler` ship with `internal/domain`,
  `application`, `ports`, `infrastructure` subdirectories from day one.
- Every PR creating a new feature must declare which bounded context it
  belongs to and respect the boundary rules.
- API versioning starts at v1 from the first endpoint shipped.
- OTel collector instrumented in `deploy/docker/compose.yaml` and Helm
  chart from M1.
- New developers (or future-you in 6 months) can navigate the codebase
  using these documented patterns.

## Open questions

- Do we publish a public OpenAPI spec for the REST adapter from M5?
  Probably yes — credibility lever for the technical persona.
- gRPC vs HTTP for service-to-service? Default to HTTP for simplicity;
  reserve gRPC for hot paths (validator on every mutation).
