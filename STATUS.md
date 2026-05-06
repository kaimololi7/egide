# Egide — Current status

**Phase**: M5 closing → M6 ramp-up (Batch U — service-account auth, SSE NATS,
OSCAL SSP export, real LLM drafting via `/v1/llm/complete`)
**Date**: 2026-05-06

## What is in this repo right now

- Working multi-language application (TS + Go + Python) totalling ~16 kLOC
  of source (excluding tests). All sprints M0–M5 livrés ; M5–6 follow-ups
  (RLS, Helm, providers, Better-Auth, NatsClient, agents/common tests,
  landing UX) livrés ; **Batch U** (service-account auth + SSE NATS +
  OSCAL + LLM drafting) livré le 2026-05-06.
- Monorepo structure scaffolded: `apps/`, `services/`, `agents/`, `edge/`,
  `packages/`, `ontologies/`, `deploy/`, `docs/`.
- Root manifests: `package.json` (pnpm workspace), `pnpm-workspace.yaml`,
  `turbo.json`, `go.work`, `pyproject.toml` (uv workspace).
- License: AGPL-3.0-only (`LICENSE`) + commercial placeholder (`LICENSE-COMMERCIAL.md`).
- **17 ADRs gravé** (cf. `docs/adr/`):
  - 001 Foundation (positioning, audience, scope)
  - 002 Licensing (AGPL + commercial dual)
  - 003 Stack (TS + Go + Python) — *amended 2026-05-05*
  - 004 Multi-LLM router with degraded mode — *amended 2026-05-05*
  - 005 Policy-as-Code multi-target — *MVP scope reduction 2026-05-05*
  - **006 Graph persistence (PG recursive CTE + JSONB)**
  - **007 RAG normative (pgvector)**
  - **008 Job queue (NATS JetStream from M1)**
  - **009 Eval framework (custom pytest, Inspect AI later)**
  - **010 Approval workflow primitives**
  - **011 Agent strategy (super-agent + PydanticAI)**
  - **012 Terminology (agents / AI workers / collectors)**
  - **013 MVP persona (technical staff + operational RSSI)**
  - **014 Security by design (OWASP Web + LLM Top 10)**
  - **015 Architectural principles (hexagonal selective + DDD + 12-factor)**
  - **016 Secure SDLC (full-strict from M1)**
  - **017 Front-end identity and design system**
- Architecture, roadmap (recalibrated to 18-24 months), editions matrix,
  migration plan, Intent IR spec, security overview, architecture
  principles guide, threat model template, design system reference,
  landing page blueprint, dashboard blueprint.
- 10 ontology clusters migrated from `process-pyramid` (~2 250 lines YAML).
- Drizzle DB schema (~407 LOC, 13 tables) — migrations not yet generated.
- 18 Claude Code skills migrated/added in `.claude/skills/`.

## What is NOT in this repo yet

- Application logic (services have `cmd/server/main.go` scaffolds with no
  business code ; AI workers are empty Python packages with `__init__.py`
  only).
- `apps/api` (Bun + Hono + tRPC) — scaffold pending.
- `apps/web` (Next.js 15) — scaffold pending.
- `apps/cli` (Bun-built `egide`) — scaffold pending.
- `packages/llm-router` (TS LLM Router) — scaffold pending.
- `packages/messaging` (TS NATS wrappers) — scaffold pending.
- `packages/oscal`, `packages/policy-targets` — to add when needed.
- Threat model files yet (template at `docs/threat-models/README.md`,
  first three required at M1 S1 : `multi-tenant-isolation.md`,
  `api-gateway.md`, `llm-router.md`).
- Drizzle migrations (`packages/db/drizzle/`) — generate with
  `pnpm --filter @egide/db generate` against running Postgres.
- Trademark check for "Egide" / "Égide" in EU.
- Helm chart (`deploy/helm/`) — empty, lands at M6 with public release.
- Skills file `shacl-validation.md` to tag as post-MVP per ADR 003 amendment.

## Decisions taken (2026-05-05)

Beyond the original ADR set, the following have been gravé:

- **MVP persona** (cf. ADR 013): technical staff "forced" into GRC +
  operational RSSI of PME/ETI 50-500. NOT the quality manager. NOT the
  political CISO.
- **Stack additions**: NATS JetStream (M1, not M5+), pgvector (M1),
  PydanticAI + Instructor (replaces direct Anthropic SDK port from aegis),
  Better-Auth (replaces Supabase as default), Docling (replaces
  Unstructured as primary).
- **Compiler MVP**: Rego only (Ansible deferred to M6).
- **Architecture**: hexagonal selective (strict on validator + compiler,
  ports & adapters elsewhere, Next.js conventions on web).
- **Security**: full-strict SDLC from M1 (cosign + SBOM + SAST + SCA
  bloquants), threat model per non-trivial feature, OWASP Web + LLM
  Top 10 mapping mandatory.
- **Roadmap**: recalibrated to MVP at M5-M6, public release at M6, first
  paying customer at M9-M10, 5-10 customers at M18-M24 (vs original
  M3 MVP / M12 5-10 customers).

## Anti-tools forbidden (cf. CLAUDE.md)

- LangChain / LangChain.js (PydanticAI replaces)
- Temporal (NATS suffices for solo)
- Neo4j (PG recursive CTE suffices)
- Kafka / Redpanda (NATS suffices)
- Elasticsearch (PG tsvector + pgvector replace)
- MongoDB
- HashiCorp Sentinel (BSL ; CloudFormation Guard / regula instead)
- CrewAI / AutoGen / DSPy
- Anthropic Agent SDK (locks to Claude)

## M1 sprint S1 progress (2026-05-05)

### Done

- ✅ `.github/workflows/ci.yml` with full-strict SDLC pipeline (lint
  TS+Go+Python, typecheck, tests, semgrep, gosec, ruff-sec, bandit,
  gitleaks, osv-scanner, trivy fs, helm lint, syft SBOM).
- ✅ `.github/PULL_REQUEST_TEMPLATE.md` with OWASP Web + LLM + architecture
  + front-end checklists.
- ✅ `SECURITY.md` (responsible disclosure + 90-day policy).
- ✅ `CONTRIBUTING.md` (DCO, branches, threat-model requirement).
- ✅ `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).
- ✅ Empty Go modules (`services/{validator,compiler,pipeline,datalake}` +
  `edge/agent`) — `go work sync` passes.
- ✅ Empty Python packages (`services/extractor` + `agents/{common,
  compliance,orchestrator}`) — `uv sync` ready when uv installed.
- ✅ `deploy/docker/compose.yaml` with PG+pgvector + ClickHouse + Redis +
  NATS JetStream + MinIO ; Ollama and OTel collector profile-gated.
- ✅ `deploy/docker/postgres-init/01-extensions.sql` (pgvector, pg_trgm,
  pg_stat_statements, pgcrypto).
- ✅ `deploy/scripts/init-db-rls.sql` skeleton.
- ✅ `packages/ui/` workspace with `tokens.css` (full design system per
  ADR 017) + `base.css` + `README.md`.
- ✅ `docs/threat-models/multi-tenant-isolation.md`,
  `api-gateway.md`, `llm-router.md` (3 STRIDE models per ADR 016).
- ✅ `packages/llm-router/` scaffold — `LLMProvider` interface, typed
  errors, router (budget + rate limit + privacy_mode + audit), PII
  scrubber, edition gating, 3 provider stubs (Ollama, Anthropic,
  Mistral). Typecheck + lint green.
- ✅ `packages/messaging/` scaffold — typed NATS subjects (12 subjects
  with Zod schemas), 4 stream definitions, NatsClient skeleton.
  Typecheck + lint green.
- ✅ `apps/api/` scaffold — Bun + Hono + tRPC + secure-headers + CORS +
  pino logger with PII redaction + 5 bounded context routers under v1
  namespace + health/ready/version endpoints. Typecheck + lint green.

### Verified

- `pnpm typecheck` ✅ all 5 workspaces pass
- `pnpm lint` ✅ all 5 workspaces pass
- `go work sync` ✅ all 5 modules registered

## M4-M5 sprint (2026-05-15)

### Done

- ✅ **Compiler service** (`services/compiler/`) — Go hexagonal, port 8003.
  - Domain: `Intent` IR types (5 layers, anchors, fixtures, severity).
  - Generator: Intent IR → Rego via `text/template`. Imports `rego.v1`, METADATA annotations, `allow` + `violation` rules.
  - 5 built-in controls: C01 db.backup, C02 storage.encryption, C03 logging.access, C04 iam.mfa, C05 network.egress. Each with ISO 27001:2022 + NIS2 anchors + 3-5 test fixtures.
  - Application layer: `CompileUseCase`, `CompileTestUseCase`.
  - HTTP handler (Echo v4): `POST /v1/compile`, `POST /v1/compile/test`, `GET /v1/intents`, `GET /healthz`.
  - Pure-Go fixture evaluator (no OPA binary). `go build ./...` + `go test` — all green.

- ✅ **tRPC compilation router** (`apps/api/src/contexts/compilation/router.ts`) — 3 procedures: `listIntents`, `compile`, `compileTest`. Proxies to `COMPILER_URL`.

- ✅ **CLI compile commands** (`apps/cli/src/commands/compile.ts`):
  - `egide compile rego <intent-id>` — writes `.rego` or stdout.
  - `egide compile test <intent-id>` — renders fixture pass/fail table.
  - `egide compile list` — offline fallback with 5 built-ins.

- ✅ **`CompiledArtifact` component** (`apps/web/src/components/CompiledArtifact.tsx`) — ADR 017 signature component. shiki Rego syntax highlighting, 32px rows, `<AnchorChip>`, `<DecisionBadge>`, fixture results table.

- ✅ **Compile dashboard page** (`apps/web/src/app/(dashboard)/compile/page.tsx`) — intent selector, compile + run-fixtures buttons, `CompiledArtifact` viewer.

- ✅ **Eval extension** (50 clf + 10 gen + 15 coh fixtures):
  - 50 classification fixtures (6 annotated `xfail_heuristic: true` — French/ambiguous, require LLM).
  - 10 generation fixtures (`expect_contains` / `expect_not_contains` on Rego output).
  - 15 coherence fixtures with Python fallback validator (11 rules covered).
  - **Test results: 81 passed, 10 skipped, 6 xfailed — 0 failures.**

- ✅ **Validator unit tests** (`services/validator/internal/rules/rules_test.go`) — 77 test cases (27 top-level + 50 sub-tests) covering all 25 rules. Each rule has `pass` + `fail` fixtures ; `TestAll_ValidGraphPassesAllRules` regression-guards the canonical valid graph. `go test ./internal/rules/... -count=1` ✅.

### Verified

- `go build ./... && go test ./internal/generators/rego/...` ✅ compiler
- `go build ./... && go test ./internal/rules/...` ✅ validator (77 tests)
- `pnpm typecheck` ✅ apps/api, apps/cli, apps/web
- `uv run pytest tests/eval/ -q` ✅ 81 passed, 10 skipped, 6 xfailed

## Sprint M5-M6 (2026-05-15) — Persistence + Helm

### Done

- ✅ **Drizzle migrations** (`packages/db/drizzle/`):
  - `0002_better_auth.sql` + down — Better-Auth tables (account, session, verification, rate_limit) + patches `users` (email_verified, image, updated_at).
  - `0003_rls.sql` + down — RLS policies on 15 tenant-scoped tables. `egide_current_tenant()` helper reading `current_setting('egide.current_tenant_id')`. Roles `egide_app` (RLS-enforced) and `egide_admin` (BYPASSRLS for migrations).
  - `deploy/scripts/init-db-rls.sql` simplifié pour pointer vers `0003_rls.sql`.

- ✅ **RLS coverage** — 15 tables enforced (tenants, users, licenses, pyramids, pyramid_versions, mutations, directives, intents, compiled_artifacts, llm_calls, evidence_blobs, audit_logs, integrations, kpi_actuals, approval_requests). `ontology_chunks` global. Better-Auth tables hors RLS.

- ✅ **Helm chart** (`deploy/helm/`) :
  - `Chart.yaml` v0.1.0, AGPL-3.0-only.
  - `values.yaml` — défauts souverains : NetworkPolicy on, runAsNonRoot, readOnlyRootFilesystem, drop ALL caps, registres EU only.
  - `templates/_helpers.tpl` — labels/selectors/image helpers.
  - `templates/NOTES.txt` — pre-install fail si `auth.secret` vide/<32 chars ou `global.edition` invalide.
  - `templates/secret.yaml` — assemble `BETTER_AUTH_SECRET` + URLs DB/Redis/NATS + clés LLM.
  - `templates/api-deployment.yaml` — Deployment + Service api hardcés (liveness/readiness `/health`).
  - `templates/serviceaccount.yaml` — `automountServiceAccountToken: false`.
  - `helm lint` ✅ ; `helm template` rend Deployment + Service + Secret + ServiceAccount.

- ✅ **Confirmé déjà fait dans sprints précédents** :
  - **Better-Auth wiring** : `apps/api/src/auth.ts` (Postgres adapter, argon2id, secure cookies, rate-limit), `server.ts` monte `/api/auth/*`, `trpc.ts` expose `protectedProcedure`/`adminProcedure`.
  - **LLM providers** : `ollama.ts` (245 LOC), `anthropic.ts` (358 LOC), `mistral.ts` (368 LOC) — implémentations réelles, no stubs.
  - **NatsClient** (`packages/messaging/src/client.ts`, 256 LOC) — connect/publish/consume + Zod + JetStream + DLQ.

### Verified

- `helm lint deploy/helm` ✅
- `helm template egide deploy/helm` ✅
- `pnpm typecheck` ✅ apps/api, packages/llm-router, packages/messaging
- `go build ./... && go test ./internal/rules/...` ✅ validator (77 tests)
- `go build && go test ./internal/generators/rego/...` ✅ compiler

### Remaining

- ~~Templates Helm pour `validator`, `compiler`, `extractor`, `web`~~ ✅ (5 deployments + ingress + networkpolicy + PDB)
- ~~Subcharts dependencies (postgresql, redis, nats, minio)~~ ✅ (5 pinned in `Chart.yaml`)
- ~~post-install Job pour appliquer la migration RLS~~ ✅ (`templates/migrations-job.yaml`, post-install/upgrade hook, sépare `DATABASE_URL` egide_app de `PG_ADMIN_URL` BYPASSRLS)
- ~~DB lookup réel dans `apps/api/src/middleware/tenant.ts`~~ ✅ (Drizzle `db.query.users.findFirst`)
- Drizzle Better-Auth adapter (au lieu du Pool brut) — optionnel
- Ingress + TLS template + NetworkPolicy templates ✅

### Sprint Batch U (2026-05-06) — service-account auth + SSE NATS + OSCAL + real LLM drafting

- ✅ **Service-account auth** (`apps/api/src/middleware/tenant.ts` +
  `trpc.ts`) :
  - `EGIDE_SERVICE_TOKENS` JSON env (label, sha256 tokenHash, scopes,
    allowedTenants) ; tokens never stored in DB.
  - `Authorization: Bearer` + `X-Egide-Tenant-Id` header pattern,
    timing-safe hash compare, fail-closed on parse error.
  - `serviceProcedure(scope)` wrapper for tRPC + `authenticateServiceAccount()`
    helper for direct Hono routes.
  - `EGIDE_SYSTEM_USER_ID` (default `0…beef`) used as `created_by` when
    a service account writes (FK preserved). Seeded by
    `deploy/scripts/seed-system-user.sql`.
  - `pyramid.persist` now `serviceProcedure("pyramid:persist")`.

- ✅ **Web SSE → NATS `egide.v1.pyramid.progress`**
  (`apps/web/src/app/api/pyramid-progress/[id]/route.ts` +
  `apps/web/src/lib/nats.ts`) :
  - Singleton NATS connection (Node runtime, edge-incompatible by design).
  - Ephemeral JetStream consumer on the EVENTS stream, deliver-all replay,
    auto-cleanup after 60s of inactivity.
  - Frame filter by `pyramid_id` ; terminates on `DONE`/`FAILED` ;
    heartbeat 15s ; overall timeout 5min ; abort cleanup.
  - Synthetic-phase fallback when NATS is unreachable (dev mode).

- ✅ **OSCAL SSP serializer** (`packages/oscal/`) :
  - Pure-function `serializePyramidToSSP()` producing valid OSCAL 1.1.2
    `system-security-plan` shape (deterministic UUIDs, framework → profile
    href mapping, components/by-policy + implemented-requirements/by-anchor).
  - 3 Vitest cases passing.
  - `audit.exportOSCAL` no longer a stub: returns `{ ssp, meta }` and writes
    `audit_logs` entry. Tenant-scoped lookup ; FK-safe.

- ✅ **`POST /v1/llm/complete`** (`apps/api/src/contexts/llm/routes.ts`) :
  - Direct Hono route (not tRPC) for service-account workers.
  - Scope `llm:complete` enforced ; provider selection env-driven
    (Ollama / Anthropic / Mistral) ; 503 in `template_only`.
  - Per-call audit row in `llm_calls` (success + failure paths).
  - Returns `{content, tool_uses, usage, cache_hit, est_cost_micro_usd,
    latency_ms, finish_reason, provider, model}`.

- ✅ **Real LLM drafting** in `agents/orchestrator/.../worker.py` :
  - `_phase_drafting` calls `/v1/llm/complete` per anchor cluster when
    `EGIDE_LLM_ENABLED=1` + `EGIDE_ORCHESTRATOR_TOKEN` set.
  - JSON-only contract from the model ; cited anchors re-attached
    machine-side (Q01 hallucination guard preserved).
  - Per-cluster fallback to deterministic template on HTTP / parse error.

- ✅ **Worker auth wired** : orchestrator now sends `Authorization: Bearer`
  + `X-Egide-Tenant-Id` on `/trpc/v1.pyramid.persist` so the API can
  authenticate it as a service account.

### Verified

- `pnpm --filter @egide/api typecheck` ✅
- `pnpm --filter @egide/web typecheck` ✅
- `pnpm --filter @egide/oscal typecheck` + `vitest` ✅ (3/3)
- `pnpm --filter @egide/llm-router typecheck` ✅
- `uv run pytest tests/eval/runners/test_j1_state_machine.py` ✅ (10/10)
- `uv run mypy agents/orchestrator/src` ✅ on new code (1 pre-existing
  unused `# type: ignore` warning at line 68, unrelated)

### Sprint M5-M6 follow-ups (2026-05-15)

- ✅ **Landing UX sprint** : 7 leviers (cascade cliquable hash-driven, install one-liner + cosign badge, LiveStatus GitHub API ISR 1h, TerminalReplay one-shot + bouton replay, OG/favicon/apple-icon dynamiques `next/og`, footer cosign verify + PGP, ShowMeTheCode hashchange listener).
- ✅ **agents/common tests** (`agents/common/tests/`) : 27 tests pytest async — `CircuitBreaker` state machine (CLOSED→OPEN→HALF_OPEN avec timeout + reset failure-count + concurrent calls), `HallucinationGuard` Q01 (extract regex 6 frameworks + verify lookup async), `errors` (codes uniques + retryable invariants), `audit` (AuditContext/Wrapper). `uv run pytest` ✅ 27/27.
- ✅ **Compiler test fix** : double `package` declaration in `services/compiler/internal/generators/rego/generator_test.go` corrigé. `go test ./...` ✅.

### Remaining for M1 S1 / S2 (legacy section)

1. **Drizzle migrations** : run `pnpm --filter @egide/db generate` against
   the dev Postgres ; commit `packages/db/drizzle/`. Then add migrations
   for `pyramid_nodes`, `pyramid_edges`, `ontology_chunks`,
   `approval_requests`, `approval_signatures`.
2. **Apply RLS** : extend `deploy/scripts/init-db-rls.sql` with per-table
   policies once migrations exist.
3. **Better-Auth integration** in `apps/api` : populate session + tenant
   context middleware ; bind to Postgres adapter.
4. **Scaffold `apps/cli`** : Bun-built `egide` binary with `auth`,
   `version`, `ping`, `pyramid`, `compile`, `approval` subcommands.
5. **Scaffold `apps/web`** : Next.js 15 RSC shell + Better-Auth client +
   import `@egide/ui/styles/base.css` + health-check page.
6. **Scaffold `agents/common`** : PydanticAI + Instructor + ported
   `CircuitBreaker` from aegis + LLMClient adapter + audit trail wrapper
   + hallucination guard scaffold.
7. **Implement provider clients** in `packages/llm-router` (Ollama first,
   then Anthropic, then Mistral) — replace the throw stubs.
8. **Implement NatsClient** in `packages/messaging` — connect, publish,
   consume with Zod validation.

After M1: extractor (Python), validator port (Go, hexagonal), first AI
worker tools, RAG ingestion of ontologies. Then compiler.

## How to use this repo today

This repository is meant to be **read** before any code is written. Future
Claude Code sessions should:

1. Open this `STATUS.md`.
2. Read `CLAUDE.md` for principles, terminology, security rules.
3. Read the relevant ADR before touching a service (16 ADRs to choose from).
4. Read `docs/architecture-principles.md` before writing code.
5. Read `docs/security.md` before any security-relevant change.
6. Consult `docs/migration.md` for "where does X come from".
7. Update this `STATUS.md` whenever a phase completes.

## Source repositories (frozen, not deleted)

- `~/dev/process-pyramid/` — frontend + ontologies + Python validator. Do
  not commit there. Read-only reference.
- `~/projects/aegis-platform/` — Go services + Python agent framework + edge
  agent. Do not commit there. Read-only reference.

Both remain on disk as a fallback if a migration choice proves wrong.
