# Egide — Roadmap

> Solo founder, patient horizon. Correctness over speed. The plan favors a
> deeply defensible product over a fast-shipped commodity.

**Last updated**: 2026-05-05
**Current state**: Phase M0 (scaffolding + decisions, ADRs 001–013 acted).

## North star

By **M18-M24**: a public open-source release under AGPL-3.0 with a working
MVP covering **J1 (drop docs)**, **J3 (Rego compiler)**, and **J8 (LLM
router)**, plus 3–5 paying customers. ARR target 30–80K€ at end of year 2.

The previous "M12 with 50–150K€ ARR" target is recalibrated downward
(see "Recalibration 2026-05-05" below). Solo + patient horizon = honest
timeline.

## Phases

### M0 — Foundation (4–6 weeks, **current**)

**Goal**: gravé the decisions and scaffold the monorepo. No application code yet.

| Deliverable | Status |
|---|---|
| Monorepo structure (`apps`, `services`, `agents`, `edge`, `packages`, `ontologies`, `deploy`, `docs`) | done |
| Root manifests (package.json, go.work, pyproject.toml, turbo.json) | done |
| ADRs 001–005 (foundation, licensing, stack, LLM router, multi-target compiler) | done |
| ADRs 006–013 (graph, RAG, queue, eval, approval, agent strategy, terminology, persona) | done |
| README, CLAUDE.md, LICENSE (AGPL-3.0), LICENSE-COMMERCIAL.md | done |
| `docs/architecture.md`, `docs/roadmap.md`, `docs/editions.md`, `docs/migration.md` | done |
| TAI Intent IR public spec draft (`docs/specs/intent-ir.md`) | done |
| Skill files migrated (`.claude/skills/`) — 15 skills | done |
| 10 ontology clusters migrated from `process-pyramid` | done |
| Drizzle DB schema + migrations | partial (schema yes, migrations to generate) |
| Trademark check for "Egide" / "Égide" in EU | pending |
| `.github/workflows/ci.yml` (lint TS+Go+Python) | pending |
| `deploy/docker/compose.yaml` (PG+pgvector+ClickHouse+Redis+NATS+Ollama) | pending |
| Fix `go.work` (modules not yet created) and `pyproject.toml` (workspace members) | pending |

### M1–M5 — MVP J1 + J3 (Rego only) + J8 (20 weeks)

**Goal**: a demoable product that drops docs, generates a pyramid, and
compiles selected policies into **Rego only** (Ansible deferred to M6+,
cf. ADR 005 amendment). LLM router supports BYOK Anthropic + local
Ollama at minimum. Template-only mode works without any AI key. CLI
ships alongside the web UI.

#### Sprint S1–S2 (M1, weeks 1–2)
- `packages/db` — Drizzle schema + first migrations (incl. `pyramid_nodes`,
  `pyramid_edges`, `ontology_chunks`, `approval_requests`).
- `apps/api` — Bun + Hono + tRPC scaffolding, **Better-Auth**, health check.
- `packages/llm-router` — interface + Anthropic + Ollama + Mistral La Plateforme.
- `packages/messaging` — NATS JetStream wrappers (TS).
- `apps/web` — minimal shell, login, dashboard placeholder.
- `apps/cli` — Bun-built `egide` binary, basic commands (auth, ping, version).
- Docker Compose dev: Postgres+pgvector + ClickHouse + Redis + NATS + Ollama.
- `.github/workflows/ci.yml` enforcing lint TS+Go+Python.

#### Sprint S3–S5 (M2, weeks 3–6)
- `services/extractor` (Python) — Docling + pypdf + python-docx + MarkItDown.
  Endpoint: `POST /extract` returns structured JSON.
- `agents/common` — PydanticAI + Instructor + custom `CircuitBreaker` +
  LLM Router adapter + audit trail wrapper + hallucination guard.
- `agents/compliance` — multi-step PydanticAI super-agent (ADR 011) with
  the first 5 tools: `search_anchors`, `classify_chunk`, `draft_policy`,
  `gap_analysis`, `validate`.
- `services/extractor/ingest_ontologies.py` — embed and load 10 cluster
  YAMLs into `ontology_chunks` (RAG bootstrap).
- `tests/eval/` — 20 classification fixtures + first scoring runners.

#### Sprint S6–S9 (M3, weeks 7–12)
- `services/validator` (Go) — port the 25 deterministic rules. SQL CTE
  queries from `embed.FS`. All 55 unit tests pass in Go.
- `agents/orchestrator` — Python state machine driving J1 phases via NATS,
  streaming progress.
- `apps/web` — drop-zone UI, live progress timeline (SSE), pyramid viewer
  (read-only), gap highlights.
- `apps/cli` — `egide pyramid generate`, `egide pyramid validate`.

#### Sprint S10–S14 (M4–M5, weeks 13–20)
- `services/compiler` (Go) — scaffolding, Intent IR types, generator interface.
- `services/compiler/generators/rego` — production-grade Rego generator
  for 5 high-value controls (DB backup, encryption-at-rest, access logging,
  MFA enforcement, network egress). Each shipped with fixtures + `opa test`
  in CI.
- Bundled OPA binary in compiler container.
- `apps/web` — compiler viewer with syntax highlighting (Shiki) and
  "Test" button.
- `apps/cli` — `egide compile rego`, `egide compile test`.
- `tests/eval/` — extended to 50 classification + 10 generation + 15 coherence fixtures.

**Exit criteria M5** (replaces previous M3 exit criteria):
- Internal demo: drop a 14-PDF folder → pyramide visible → 1 compiled
  Rego bundle that blocks a non-conforming K8s deployment in a k3d sandbox.
- Eval matrix published per provider (Sonnet 4.6 vs Mistral Large vs
  Ollama Mistral 7B) on 50+ fixtures.
- CLI parity: every web action accessible via `egide` CLI.
- 0 critical bugs on golden path.
- Demo Loom: optional, can wait per founder's call.

### M6 — Ansible target + public open-source release (6 weeks)

| Deliverable | Why |
|---|---|
| `services/compiler/generators/ansible` — playbooks + Molecule tests | Persona reads Ansible daily |
| GitHub public repo, README polished | Show HN / Reddit / r/sysadmin / r/cybersecurity exposure |
| `CONTRIBUTING.md`, DCO, Code of Conduct | Open-source hygiene |
| Helm chart for K8s install | Sovereign cloud hosters |
| Docker Compose one-liner install | Solo evaluators |
| Tutorial: "Generate ISO 27001 + NIS2 pyramid from your Ansible inventory" | Persona-aligned onboarding |
| Tutorial: "Compile your incident-response policy to Rego and Ansible" | Show the moat |
| 4 frameworks production-ready (ISO 27001, NIS2, CIS, DORA), ISO 9001 secondary | Cybersec persona coverage |
| Show HN post + /r/sysadmin + /r/cybersecurity + /r/devops | Discovery on persona-relevant subs |
| Discord or Matrix community channel | Engagement |

**Exit criteria M6**: 100+ GitHub stars in 4 weeks post-launch, ≥10
Discord/Matrix members, ≥3 unsolicited installation reports, CLI usage
visible in feedback.

### M7–M9 — J2 (agent + Proxmox connector) + CIS target + Professional edition unlock

| Deliverable | Notes |
|---|---|
| `edge/agent` (Go binary) — port from `aegis-platform`, refactor for GRC posture | Cross-platform single binary, mTLS |
| Proxmox API **collector** (services/pipeline/connectors) | Differentiator vs Vanta |
| Ansible inventory reader (collector) | On-prem essential |
| AWS / Azure / Scaleway / OVH read-only collectors | Cloud breadth |
| `services/compiler/generators/cis` — CIS Benchmarks audit scripts | Persona reads CIS daily |
| Professional edition feature flags + license check (Ed25519) | Revenue gate |
| Stripe Checkout + license key issuance | Self-serve Pro |
| Approval workflow primitives (table + state machine, ADR 010) | Required for next phases |

**Exit criteria**: 3 paying Pro customers (5–15K€/year each).

### M10–M12 — J4 (continuous compliance) + J5 (auditor view) + Kyverno target

- Drift detection with daily diff vs validated pyramid.
- Slack / email / Teams notifications via NATS subjects.
- Auditor read-only space with comments and signed export bundle (OSCAL).
- `services/compiler/generators/kyverno` (Pro+ target).
- 2 cabinet partners signed.

### M13–M16 — Enterprise edition + cloud targets

| Deliverable | Notes |
|---|---|
| Air-gapped bundle (Proxmox VM image + offline package repo) | Pre-quantified Mistral 7B / Qwen 14B included |
| SSO / SAML / OIDC via Authentik | Enterprise gate |
| White-label MSSP mode | Cabinet partner channel |
| 24/7 SLA support tier | Pricing justified |
| Signed OSCAL exports with hash chain | Audit-grade evidence |
| `services/compiler/generators/{aws_config,azure_policy,scaleway_iam}` | Cloud breadth |
| `services/compiler/generators/falco` | Runtime detection |
| Langfuse self-hosted for LLM observability | Pro+ ops |

**Exit criteria**: 1 Enterprise customer signed (≥30K€/year).

### M17–M20 — J9 (apply Ansible real) + J6 (strategic→executable)

- Ansible runner with dry-run-first + approval workflow (ADR 010) + execution audit.
- Directive interview wizard for DGs (J6).
- COMEX dashboard: cascade visibility, intent-vs-runtime gap.
- Public release v1.0.

**Exit criteria M20**:
- 5–10 paying customers (mix of Community + Pro + Enterprise).
- ARR 30–80K€.
- 500+ GitHub stars.
- Featured in 1 EU cybersec publication (LeMagIT, MISC, NextINpact, etc.).

## Recalibration 2026-05-05

The previous roadmap targeted MVP at M3 (3 months) and 5–10 customers +
50–150K€ ARR at M12. Honest reassessment under solo founder constraints:

- Validator port Python→Go: 3–4 weeks (not 1–2). Pydantic discriminated
  unions don't translate mechanically.
- Compiler Rego production-grade: 4–6 weeks for 5 controls usable.
- Edge agent cross-platform GRC: 6–8 weeks (not 3–4).
- Air-gapped Enterprise + Proxmox bundle: 4–6 weeks.
- B2B mid-market FR sales cycle: 3–9 months, not 1.

Realistic MVP landing at **M5–M6** (≈6 months), public release at **M6**,
first paying customer at **M9–M10**, 5–10 customers at **M18–M24**. ARR
target reduced to **30–80K€ end of year 2**. ADR 001's "patient horizon,
correctness over speed" justifies this — and the ADR 013 persona
(technical, sovereign-needing) values quality over hype.

## Beyond M12

- **J7** (multi-tenant cabinet/MSSP console).
- **J10** (full air-gapped install at one customer site).
- **Reverse compilation** (audit-by-existing): ingest existing Rego/Ansible →
  recover Intent → import into pyramid.
- **EBIOS RM** integration (workshops 1–5 as a guided wizard).
- **NATS JetStream** event bus for high-throughput audit telemetry.
- **Series A discussion** — only if traction is clear (>500K€ ARR signed).

## Anti-goals (we will not chase)

- VC-pleasing growth metrics. We trade growth for defensibility.
- US market expansion before EU saturation.
- Sigma rules / SOC features (see `aegis-platform`).
- Proprietary data formats. Every export is OSCAL or open.
- Lock-in to Anthropic or any single LLM.

## Quarterly review cadence

End of each quarter:

- One ADR captures any pivot.
- Roadmap is rewritten if reality diverges by more than 4 weeks.
- Public quarterly post on the blog (transparency reinforces trust positioning).
