# Egide — Migration plan from `process-pyramid` and `aegis-platform`

Two prior personal projects are frozen as archive. This document specifies
**file-by-file** what migrates into Egide, what gets ported to a new language,
and what stays where it is.

**Both source repositories remain on disk untouched** at:
- `~/dev/process-pyramid/`
- `~/projects/aegis-platform/`

No `rm` on either. They become read-only references and a fallback if a
migration choice proves wrong.

## Migration pattern

| Symbol | Meaning |
|---|---|
| `COPY` | Copy the file as-is (or with minor adjustments) into Egide. |
| `PORT(L)` | Port the logic to language `L` while preserving the contract. |
| `REWRITE` | Reuse the **idea** but rewrite cleanly inside Egide. |
| `KEEP` | Stays in source repo. Not migrated. |
| `LATER` | Could be useful in a future phase. Don't migrate now; cite when needed. |

## From `process-pyramid`

### Ontologies — gold, copy as-is

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `ontologies/clusters/incident-management.yaml` | `ontologies/clusters/incident-management.yaml` | COPY | All 10 clusters are excellent curation, do not retouch |
| `ontologies/clusters/change-management.yaml` | same | COPY | |
| `ontologies/clusters/risk-management.yaml` | same | COPY | |
| `ontologies/clusters/document-control.yaml` | same | COPY | |
| `ontologies/clusters/awareness-training.yaml` | same | COPY | |
| `ontologies/clusters/business-continuity.yaml` | same | COPY | |
| `ontologies/clusters/supplier-management.yaml` | same | COPY | |
| `ontologies/clusters/internal-audit.yaml` | same | COPY | |
| `ontologies/clusters/management-review.yaml` | same | COPY | |
| `ontologies/clusters/continual-improvement.yaml` | same | COPY | |
| `ontologies/registry.yaml` | `ontologies/registry.yaml` | COPY | Update `last_updated` field |

**Effort**: 30 min (copy + verify).

### Validator — port to Go

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `pipelines/coherence/graph_validator.py` (1038 LOC, 25 rules) | `services/validator/internal/rules/*.go` | PORT(Go) | One Go file per rule family: structural, cross-level, governance, cross-framework |
| `pipelines/coherence/models.py` | `services/validator/internal/models/pyramid.go` | PORT(Go) | Pydantic → Go structs with JSON tags |
| `pipelines/coherence/fragility.py` (153 LOC) | `services/validator/internal/fragility/fragility.go` | PORT(Go) | SPOF detection; small algo, fast port |
| `tests/test_validator.py` (343 LOC, 27 tests) | `services/validator/internal/rules/*_test.go` | PORT(Go) | Table-driven tests; same fixtures, Go syntax |
| `tests/test_fragility.py` | `services/validator/internal/fragility/fragility_test.go` | PORT(Go) | Same approach |

**Effort**: 1–2 weeks. The Python is well-structured (one function per rule);
mechanical translation.

### Database schema

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `packages/db/src/schema.ts` (Drizzle, 109 LOC) | `packages/db/src/schema.ts` | COPY | Augment with `licenses`, `llm_calls`, `evidence_blobs`, `directives` tables |
| `packages/db/src/index.ts` | `packages/db/src/index.ts` | COPY | |
| `packages/db/package.json` | `packages/db/package.json` | COPY | Bump versions if needed |

**Effort**: 1 day (copy + schema additions).

### TypeScript packages — partial copy

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `packages/llm/src/index.ts` | `packages/llm-router/src/providers/anthropic.ts` | REWRITE | Was a thin wrapper; expand to full provider abstraction (see ADR 004) |
| `packages/ontology/src/index.ts` | `packages/ontology/src/index.ts` | COPY | Type definitions for normative anchors |
| `packages/oscal/src/index.ts` | `packages/oscal/src/index.ts` | COPY | Type definitions; serializer in Go |
| `packages/bpmn/src/index.ts` | `packages/policy-targets/src/bpmn.ts` | COPY | Move under policy-targets package; reduced palette types |
| `packages/graph/src/index.ts` | KEEP in archive | KEEP | Neo4j stub; Egide uses Postgres + ClickHouse, not Neo4j (yet) |
| `packages/ui/src/bpmn-viewer.ts` | `apps/web/src/components/bpmn-viewer.tsx` | REWRITE | Was 22-line stub; rewrite with bpmn-js Modeler |

### Frontend — selective copy

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `apps/web/src/components/pyramid-plate.tsx` (696 LOC) | LATER | LATER | Editorial element; useful only if we keep the editorial direction (TBD post-positioning) |
| `apps/web/src/components/pyramid-matrix.tsx` (245 LOC) | LATER | LATER | Same; could be reused as matrix visualization in dashboard |
| `apps/web/src/components/streaming-generation.tsx` (305 LOC) | LATER | LATER | Could feed the J3 demo — generation in streaming is a wow effect |
| `apps/web/src/components/site/*` (header, footer, masthead) | KEEP in archive | KEEP | Tied to editorial brand; new landing in Vanta-grade direction |
| `apps/web/src/app/page.tsx` (726 LOC, current landing) | KEEP in archive | KEEP | New landing built fresh post-positioning |
| `apps/web/src/middleware.ts` | `apps/web/src/middleware.ts` | COPY | Supabase auth middleware; useful for Community/Pro |
| `apps/web/src/app/(auth)/sign-in/page.tsx` | same | COPY | Reuse auth pages |
| `apps/web/src/app/(auth)/sign-up/page.tsx` | same | COPY | |
| `apps/web/src/app/auth/callback/route.ts` | same | COPY | |
| `apps/web/src/app/app/layout.tsx` | same | COPY | Dashboard shell |
| `apps/web/src/components/ui/*` (button, card, badge, input — shadcn) | `apps/web/src/components/ui/*` | COPY | shadcn primitives, reusable |
| `apps/web/src/lib/*` (cn, supabase, typography) | same | COPY | Utility helpers |

### Backend — mostly REWRITE, the FastAPI was a stub

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `apps/api/main.py` (234 LOC, FastAPI in-memory) | KEEP in archive | KEEP | Egide rewrites the API in TypeScript (Bun + Hono + tRPC) |
| `pipelines/cli.py` (291 LOC, Typer CLI) | LATER | LATER | A CLI is useful for power users; defer to M5+ |
| `pipelines/generation/from_cluster.py` (137 LOC) | `services/validator/internal/templates/from_cluster.go` | PORT(Go) | Determinstic template builder is essential for "no-AI mode" |
| `pipelines/generation/orchestrator.py` (61 LOC, stub) | KEEP in archive | KEEP | Was unimplemented |
| `pipelines/exports/docx_export.py` (285 LOC) | `services/extractor/src/docx_export.py` | COPY | Useful as-is; isolated Python service |
| `pipelines/oscal/serializer.py` (36 LOC, stub) | KEEP in archive | KEEP | Egide implements OSCAL in Go |
| `pipelines/bpmn/validator.py` (74 LOC, stub) | KEEP in archive | KEEP | BPMN validation moves to TS package or Go |
| `pipelines/ontology/loader.py` (258 LOC) | `services/validator/internal/ontology/loader.go` | PORT(Go) | YAML loading + Pydantic models → Go yaml.v3 + structs |

### Skills (Claude Code prompts)

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `.claude/skills/iso27001-2022.md` | `.claude/skills/iso27001-2022.md` | COPY | Update version refs |
| `.claude/skills/iso9001-2026.md` | same | COPY | |
| `.claude/skills/nis2-directive.md` | same | COPY | |
| `.claude/skills/dora-regulation.md` | same | COPY | |
| `.claude/skills/itil4-framework.md` | same | COPY | |
| `.claude/skills/bpmn-2-0.md` | same | COPY | |
| `.claude/skills/dmn-decision-model.md` | same | COPY | |
| `.claude/skills/shacl-validation.md` | same | COPY | |
| `.claude/skills/oscal-structure.md` | same | COPY | |
| `.claude/skills/pyramid-coherence-rules.md` | same | COPY | Update rule count |
| `.claude/skills/audit-readiness.md` | same | COPY | |
| `.claude/skills/process-mining-light.md` | LATER | LATER | Mining is post-MVP |
| (new) `.claude/skills/hds-health-data.md` | NEW | REWRITE | Add for HDS sovereign use case |
| (new) `.claude/skills/cis-benchmarks.md` | NEW | REWRITE | For policy compiler target |
| (new) `.claude/skills/opa-rego.md` | NEW | REWRITE | For policy compiler |
| (new) `.claude/skills/kyverno.md` | NEW | REWRITE | For policy compiler |
| (new) `.claude/skills/ansible.md` | NEW | REWRITE | For policy compiler |
| (new) `.claude/skills/llm-router-providers.md` | NEW | REWRITE | List of supported providers + capabilities |
| (new) `.claude/skills/proxmox-api.md` | NEW | REWRITE | For pipeline connector |

### What to NOT migrate

- `pipelines/audit/` — empty
- `pipelines/mining/` — empty
- `infra/` — empty
- `outputs/*.json`, `*.docx` — generated artifacts; regenerate as needed
- `screenshots/` — landing iterations, archive
- `apps/web/src/app/pricing/page.tsx` — the new pricing will be redesigned
- `apps/web/src/app/opengraph-image.tsx`, `apple-icon.tsx`, etc. — tied to old brand

## From `aegis-platform`

### Agent framework — gold, copy as-is

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `agents/common/` (~700 LOC of `BaseAgent` + `CircuitBreaker` + tool support) | `agents/common/` | COPY | Adapter to LLM Router replaces direct Anthropic SDK call |
| `agents/common/src/agent.py` (BaseAgent) | same | COPY then EDIT | Replace `import anthropic` with `from llm_router_client import LLMClient` |
| `agents/common/src/circuit_breaker.py` | same | COPY | Reusable |
| `agents/common/src/tools.py` | same | COPY | Tool execution framework |
| `agents/common/pyproject.toml` | same | COPY then EDIT | Adjust deps |

**Effort**: 2–3 days (copy + adapter rewrite for LLM router).

### Agents — partial use

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `agents/triage/` (168 LOC, real) | KEEP in archive | KEEP | SOC-specific |
| `agents/investigation/` (155 LOC, real) | KEEP in archive | KEEP | SOC-specific |
| `agents/anomaly-detector/` (133 LOC, real) | KEEP in archive | KEEP | SOC-specific |
| `agents/compliance/` (35 LOC, stub) | `agents/compliance/` | REWRITE | Egide implements this for real (J1 + framework mapping) |
| `agents/posture/` (46 LOC, basic) | LATER | LATER | Useful pattern when agent telemetry comes online (M5+) |
| `agents/identity/` (35 LOC, stub) | LATER | LATER | |
| `agents/vulnerability/` (35 LOC, stub) | LATER | LATER | |
| `agents/data-quality/` (26 LOC, stub) | LATER | LATER | |
| `agents/executive-summary/` (26 LOC, stub) | LATER | LATER | Could become J6 (board summary generator) |
| `agents/ai-safety/` (26 LOC, stub) | LATER | LATER | |
| `agents/ai-orchestrator/` (26 LOC, stub) | `agents/orchestrator/` | REWRITE | Egide rewrites for pyramid generation workflow |

### Services Go — pipeline + datalake + edge

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `services/pipeline/` (2560 LOC, real) | `services/pipeline/` | COPY then REFACTOR | Drop Sigma rules and SOC normalizations; keep parsers (syslog, JSON, WinEvent, CEF) and normalize to a "control event" instead of OCSF |
| `services/pipeline/internal/parser/` | same | COPY | Parsers are protocol-level, fully reusable |
| `services/pipeline/internal/normalizer/` | REWRITE in Egide | REWRITE | Maps to GRC schema, not OCSF |
| `services/datalake/` (1257 LOC, real) | `services/datalake/` | COPY then REFACTOR | ClickHouse client and query API; refactor schema to Egide's audit/evidence model |
| `services/intake/` (452 LOC) | `services/datalake/internal/intake/` | COPY | Folded into datalake; intake API handles ingestion |
| `services/syslog/` (571 LOC) | `services/pipeline/internal/syslog/` | COPY | Syslog receiver folded into pipeline |
| `services/detection/` (3502 LOC, Sigma engine) | KEEP in archive | KEEP | SOC-only |
| `services/alerts/` (2610 LOC, alert engine) | KEEP in archive | KEEP | SOC-only |
| `services/soar/` (1439 LOC) | KEEP in archive | KEEP | SOC playbooks; Egide uses Ansible runner instead (J9) |
| `services/auth/` (474 LOC, stub) | KEEP in archive | KEEP | Egide auth is in TS API gateway |
| `services/gateway/` (105 LOC, skeleton) | KEEP in archive | KEEP | Egide gateway is TS Bun + Hono |
| `services/commander/` (292 LOC, stub) | KEEP in archive | KEEP | |
| `services/assets/` (359 LOC, basic) | LATER | LATER | Useful pattern for inventory; Egide implements differently |

**Effort**: 2 weeks (copy + refactor of pipeline + datalake).

### Edge agent — base for J2

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `edge/endpoint-agent/` (3500 LOC, partial) | `edge/agent/` | COPY then REFACTOR | Drop SOC collectors (process trees, network connections), keep posture (encryption, MFA, patch level), add Proxmox client and Ansible inventory reflection |
| `edge/network-probe/` | KEEP in archive | KEEP | SOC-specific |
| `edge/cloud-collectors/` | LATER | LATER | Useful structure for cloud connectors in J2 |
| `edge/identity-collectors/` | LATER | LATER | |

**Effort**: 3–4 weeks (refactor of endpoint agent for GRC posture).

### Schemas

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `schemas/proto/aegis.proto` (167 LOC) | `schemas/proto/egide.proto` | REWRITE | Drop SOC messages; add governance messages (ArtifactMutated, ComplianceFinding, CompiledArtifact, DirectiveSigned) |
| `schemas/avro/*.avsc` (121 LOC, 6 schemas) | `schemas/avro/*.avsc` | REWRITE | Same logic; new entity types |
| `schemas/sigma-rules/*.yml` (5 rules) | KEEP in archive | KEEP | SOC-only |
| `schemas/events/` | REWRITE | REWRITE | Egide event catalog |

### Libs (Go shared libs)

| Source path | Egide path | Action | Notes |
|---|---|---|---|
| `libs/go/kafka/` (if exists) | `libs/go/messaging/` | COPY then EDIT | Replace Kafka/Redpanda with NATS in Egide; same wrapper pattern |
| `libs/go/observability/` | `libs/go/observability/` | COPY | slog + Prometheus + OTel |
| `libs/go/ocsf/` | KEEP in archive | KEEP | OCSF is SOC-specific; Egide has its own schema |

### What to NOT migrate

- All Sigma rules and Sigma engine
- Kill-chain stitching code
- SOAR playbook engine
- Anomaly detection algorithms (UEBA)
- OCSF mappings
- AI safety agent (interesting later but not MVP)

## Effort summary

| Category | Estimated effort | Source projects |
|---|---|---|
| Ontologies (copy YAML) | 0.5 day | process-pyramid |
| DB schema (copy + extend) | 1 day | process-pyramid |
| Frontend bits (auth, ui primitives, dashboard shell) | 2 days | process-pyramid |
| Skills migration | 0.5 day | process-pyramid |
| Validator port (Python → Go) | 1–2 weeks | process-pyramid |
| Agent framework (copy + adapter rewrite) | 2–3 days | aegis-platform |
| Pipeline + datalake (copy + refactor) | 2 weeks | aegis-platform |
| Edge agent (refactor for GRC) | 3–4 weeks | aegis-platform |
| Schemas rewrite | 3 days | aegis-platform |
| **Total porting effort** | **~8–10 weeks** | |
| Net new code (compiler, LLM router, web, services/extractor) | ~6–8 weeks | |
| **Estimated MVP duration** | **14–18 weeks** | matches roadmap M1–M3 + buffer |

## Migration order (recommended)

1. **Week 1**: ontologies + DB schema + skills (low-risk warmup).
2. **Week 2**: agent framework (`agents/common/`) + LLM router foundation.
3. **Weeks 3–4**: validator port to Go (mechanical, builds testing skill in Go).
4. **Weeks 5–6**: extractor (Python service) + first compliance agent for J1.
5. **Weeks 7–10**: policy compiler from scratch in Go (the moat — most novel code).
6. **Weeks 11–14**: pipeline + datalake refactor (only when J2 starts at M5).
7. **Weeks 15+**: edge agent refactor (M5).

## How to track migration

Each migrated file gets a comment in its Egide version:

```python
# Migrated from aegis-platform/agents/common/src/agent.py at commit abc1234
# Adapted: replaced direct anthropic SDK with LLMClient (LLM Router).
```

```go
// Ported from process-pyramid/pipelines/coherence/graph_validator.py:_rule_s01
// Original Python at commit def5678.
```

This makes it easy to backtrack to the original implementation if a migration
choice is wrong.
