# Egide — Architecture principles (operational)

Operational guide complementing ADR 015. Patterns to apply when writing
code in Egide. Read once before contributing.

## Layering — strict where the metier is complex

### Strict hexagonal: `services/validator` (Go), `services/compiler` (Go)

```
services/<svc>/
├── internal/
│   ├── domain/
│   │   ├── model/             # Pyramid, Intent, Rule, Artifact (pure Go structs)
│   │   ├── service/           # domain services (rule evaluation, intent normalization)
│   │   └── errors.go          # domain errors (typed)
│   ├── application/
│   │   ├── usecase/           # ValidatePyramid, CompileIntent, TestArtifact
│   │   └── ports/             # interfaces required by usecases
│   ├── infrastructure/
│   │   ├── postgres/          # repository implementations (pgx)
│   │   ├── nats/              # event publishers/subscribers
│   │   ├── opa/               # adapter wrapping `opa eval/test`
│   │   └── otel/              # observability adapter
│   └── transport/
│       ├── grpc/              # gRPC server bound to usecases
│       └── http/              # HTTP handlers (health, metrics)
├── cmd/
│   └── server/main.go         # composition root
├── api/
│   └── proto/                 # protobuf definitions (versioned v1/)
└── go.mod
```

**Rules**:
- `domain/` imports nothing outside the standard library.
- `application/` depends on `domain/` and `application/ports/`. No
  third-party imports.
- `infrastructure/` implements `application/ports/`. Imports
  third-party libs.
- `transport/` calls `application/usecase/`. Translates protocol
  messages to/from domain types.
- `cmd/` is the only place that imports concrete adapters.

### Light ports & adapters: `apps/api` (TS), `services/extractor` (Python)

`apps/api/src/`:

```
src/
├── contexts/                  # bounded contexts (DDD)
│   ├── pyramid/
│   │   ├── domain/            # types, value objects
│   │   ├── service/           # business logic
│   │   ├── repository/        # interface + Drizzle impl
│   │   └── router.ts          # tRPC router
│   ├── compilation/
│   ├── compliance/
│   ├── audit/
│   └── governance/
├── shared/
│   ├── auth/
│   ├── llm-router/            # façade to packages/llm-router
│   ├── nats/
│   ├── otel/
│   └── errors/
├── trpc.ts                    # tRPC root
├── server.ts                  # Hono + Bun bootstrap
└── env.ts                     # validated env (zod schema)
```

`services/extractor/src/`:

```
src/
├── domain/                    # ExtractedDocument, Section dataclasses
├── ports/
│   └── extractor.py           # Extractor ABC
├── adapters/
│   ├── docling_adapter.py
│   ├── pypdf_adapter.py
│   ├── markitdown_adapter.py
│   └── docx_adapter.py
├── service.py                 # ExtractionService selecting adapter by MIME
├── api/
│   └── http.py                # FastAPI routes
└── main.py
```

### Conventions: `apps/web` (Next.js)

Standard App Router. No hexagonal grafting:

```
apps/web/src/
├── app/                       # Next.js App Router
│   ├── (marketing)/           # public routes
│   ├── (auth)/                # auth flows
│   ├── (dashboard)/           # authenticated app
│   └── api/                   # route handlers (thin)
├── components/
│   ├── ui/                    # shadcn primitives
│   └── features/              # feature-specific components
├── lib/
│   ├── trpc-client.ts         # type-safe client to apps/api
│   ├── auth-client.ts
│   └── utils.ts
└── styles/
```

Server Actions call tRPC procedures. No direct DB or LLM access.

## DDD bounded contexts

Five contexts. Cross-context calls **only** via public APIs (tRPC, gRPC,
NATS).

| Context | Aggregates | Owns |
|---|---|---|
| **Pyramid** | Pyramid, PyramidVersion, Mutation | Graph structure, coherence, versioning |
| **Compilation** | Intent, Artifact, TestReport | TAI IR, generators, test runners |
| **Compliance** | Document, Classification, GapReport, SoA | Extraction, mapping, gap analysis |
| **Audit** | EvidenceBlob, AuditLog, OSCALExport | Chain of custody, tamper detection |
| **Governance** | Directive, ApprovalRequest, Signature, Role | Sign-off, RBAC, license, license check |

### Anti-corruption layer pattern

```python
# agents/compliance/src/extractor_client.py — anti-corruption layer

@dataclass
class ExtractedDocument:  # internal domain model
    sections: list[Section]
    metadata: DocMetadata

class ExtractorClient:
    def __init__(self, http: AsyncClient):
        self._http = http

    async def fetch(self, doc_id: UUID) -> ExtractedDocument:
        raw = await self._http.get(f"/extract/{doc_id}")
        # external Pydantic schema → internal dataclass
        return self._translate(raw.json())

    def _translate(self, raw: dict) -> ExtractedDocument:
        ...  # explicit, fail-fast on shape mismatch
```

External Pydantic schemas live at the boundary; internal dataclasses
never leak Pydantic.

## Repository pattern

Persistence behind interfaces.

```go
// services/validator/internal/application/ports/pyramid_repo.go
package ports

import "context"

type PyramidRepo interface {
    GetById(ctx context.Context, tenantID, pyramidID string) (*domain.Pyramid, error)
    GetVersion(ctx context.Context, versionID string) (*domain.PyramidVersion, error)
    SaveVersion(ctx context.Context, v *domain.PyramidVersion) error
}

// services/validator/internal/infrastructure/postgres/pyramid_repo.go
package postgres

type PgPyramidRepo struct { db *pgxpool.Pool }

func (r *PgPyramidRepo) GetById(ctx context.Context, tenantID, pyramidID string) (*domain.Pyramid, error) {
    // SQL via pgx, parameterized
}
```

Tests substitute an in-memory or test-DB implementation.

## API versioning from v1

### tRPC

```typescript
// apps/api/src/trpc.ts
export const appRouter = router({
  v1: router({
    pyramid: pyramidRouter,
    compilation: compilationRouter,
    compliance: complianceRouter,
    audit: auditRouter,
    governance: governanceRouter,
  }),
});
```

### NATS subjects

`egide.v1.pyramid.mutations` ; never `egide.pyramid.mutations` without
version. Major version bump = new stream + 6-month deprecation window.

### REST adapter (M5+)

Mirror the tRPC procedures under `/api/v1/...` with OpenAPI spec
generated from tRPC types (via `trpc-openapi`).

### CLI

```
egide pyramid generate ...    # stable since v1
egide --version
```

Deprecations announced with a console warning at least 6 months before removal.

## Reversible migrations

```
packages/db/drizzle/
├── 0001_create_tenants.up.sql
├── 0001_create_tenants.down.sql
├── 0002_add_pyramid_nodes.up.sql
├── 0002_add_pyramid_nodes.down.sql
└── ...
```

CI runs roll forward → roll back → roll forward on each migration.
"Data lost on rollback" cases require an ADR amendment + customer
notice.

## Feature flags vs editions

```typescript
// editions: hard, license-checked
if (!editionAllows(tenant.edition, "compiler.kyverno")) {
  throw new EditionUpgradeRequired("compiler.kyverno", "professional");
}

// feature flags: soft, runtime
if (await flags.isEnabled(tenant.id, "ai_worker_tool_v2_judge")) {
  // use new judge tool
}
```

Editions = revenue. Flags = velocity.

## Idempotency

Every mutating endpoint:

```typescript
// apps/api/src/contexts/pyramid/router.ts
export const pyramidRouter = router({
  v1: router({
    createMutation: protectedProcedure
      .input(z.object({
        pyramidId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
        payload: MutationPayload,
      }))
      .mutation(async ({ ctx, input }) => {
        return idempotent(
          { tenantId: ctx.tenantId, key: input.idempotencyKey },
          async () => createMutationUseCase(ctx, input),
        );
      }),
  }),
});
```

Stored deduplicated for 24h in Redis ; same key + body → cached
response ; same key + different body → 409 Conflict.

## Error taxonomy

```typescript
// packages/errors/src/index.ts
export class EgideError extends Error {
  constructor(
    public readonly code: string,           // "PYRAMID_VALIDATION_FAILED"
    public readonly message: string,
    public readonly details?: unknown,
    public readonly retryable: boolean = false,
    public readonly httpStatus: number = 500,
  ) { super(message); }
}

// HTTP error envelope
{
  "error": {
    "code": "PYRAMID_VALIDATION_FAILED",
    "message": "...",
    "details": { "ruleId": "C01", "nodeId": "..." },
    "trace_id": "abc-123",
    "retryable": false,
    "documentation_url": "https://docs.egide.io/errors/PYRAMID_VALIDATION_FAILED"
  }
}
```

Mirror types in Go (`pkg/errors`) and Python (`packages/errors`).

## Retry policy

```typescript
// packages/retry — single source of truth
export async function retry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseMs?: number; capMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 5, baseMs = 100, capMs = 30_000 } = opts;
  // exponential backoff with jitter
}
```

Never reinvented per call site.

## Observability first-class

Every service initializes OTel at startup:

```go
// services/validator/cmd/server/main.go
func main() {
    ctx := context.Background()
    shutdown := observability.Init(ctx, "validator", version)
    defer shutdown()

    app := wireApp(ctx)  // composition root
    if err := app.Run(ctx); err != nil { panic(err) }
}
```

Trace IDs propagate across HTTP, gRPC, NATS messages.

## Common pitfalls (do NOT)

- ❌ Direct cross-context import (`apps/api/src/contexts/pyramid/...`
   from `apps/api/src/contexts/audit/...`).
- ❌ Drizzle queries inside use cases — use the repository.
- ❌ Anthropic SDK called directly — use the LLM Router (ADR 004).
- ❌ Skipping the idempotency key on a mutating endpoint.
- ❌ Returning a stack trace in production error responses.
- ❌ A new Go package importing `database/sql` from outside `infrastructure/`.
- ❌ A "utility" `helpers.ts` or `utils.go` file growing beyond 100 LOC
   with unrelated functions.
- ❌ Inline secrets, even for dev (`'sk-ant-...'` in code triggers gitleaks).

## Quick references

- ADR 003 — Stack decision (TS / Go / Python isolation)
- ADR 014 — Security by design (OWASP Web + LLM Top 10)
- ADR 015 — Architectural principles (this doc's source of truth)
- ADR 016 — Secure SDLC (CI gates)
- `docs/security.md` — operational security guide
- `docs/threat-models/` — per-feature STRIDE models
