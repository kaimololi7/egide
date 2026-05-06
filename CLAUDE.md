# Egide — Claude Code config

Sovereign GRC platform that converts the **human chain of governance** (directive → policy
→ procedure → process → KPI) into a **verifiable, executable cascade**: real Rego,
Kyverno, Ansible, CIS, and cloud-policy rules generated from the same single source of
truth.

**MVP buyer (cf. ADR 013)**: technical staff "forced" into GRC (sysadmin / DevOps /
SRE / security engineer who finds themselves wearing the GRC hat) + operational RSSI
of PME 50–300 / ETI 200–500. Familiar with CLI, git, YAML, Ansible, Rego, K8s.
Allergic to Vanta-grade glossy SaaS UX. Prefer self-hostable, sovereign, transparent
tools.

**Position**: anti-Vanta. Open core. Air-gappable. Multi-LLM with choice (BYOK / EU
sovereign / local Ollama / no AI at all). CLI first-class.

## Non-negotiable principles

1. **Strategic-to-executable cascade is the moat**. Every artifact must trace upward
   to a signed directive AND downward to one or more enforcement rules. No
   orphan policies. No standalone Rego.
2. **Degraded mode without AI is mandatory** in Community edition. Templates +
   deterministic validator must produce a usable pyramid without any LLM call.
3. **Multi-LLM router** is built-in from day 1. No tenant is locked to Anthropic
   or to any single provider. Local Ollama / vLLM is a first-class option.
4. **Policy-as-Code is multi-target**. MVP ships Rego only (cf. ADR 005 amendment).
   Ansible at M6, CIS at M7, Kyverno at M10, cloud targets and Falco M13+.
   One intent, many compilations.
5. **Sovereignty by design**. Default deployment options favor EU clouds
   (Scaleway, OVH) and on-prem (Proxmox). Air-gapped Enterprise is fully supported.
6. **Pyramid coherence is enforced**. Mutations propagate or are rejected. Every
   change is versioned, hashed, and traceable to an OSCAL evidence trail.
7. **Security is structural, not bolted on** (cf. ADR 014 + 016). Every PR
   passes the OWASP Web + LLM Top 10 checklist; SAST + SCA + signing in CI;
   threat models per non-trivial feature.
8. **CLI parity with web UI** (cf. ADR 013). Every action available in `egide`
   CLI ; documented as primary interface for the technical persona.

## Stack (firm — see ADR 003)

- **Frontend**: Next.js 15 (App Router, RSC, Server Actions) + Tailwind v4 + shadcn/ui.
- **API gateway**: Bun + Hono, TypeScript, tRPC. Auth: Better-Auth.
- **CLI**: Bun-built single binary (`apps/cli`).
- **Validator service**: Go — strict hexagonal (cf. ADR 015) ; ports 25 deterministic
  rules using PG recursive CTE (cf. ADR 006). SHACL post-MVP (cf. ADR 003 amendment).
- **Policy compiler**: Go — strict hexagonal ; the moat. MVP = Rego only.
- **Pipeline**: Go — log/event ingestion (parsers from `aegis-platform`).
- **Datalake**: Go — ClickHouse for audit trail and evidence storage.
- **Edge agent**: Go — cross-platform binary, mTLS, posture collection.
- **Doc extractor (J1)**: Python — Docling primary + pypdf fallback +
  python-docx + MarkItDown. Avoid Unstructured (too heavy for air-gapped).
- **AI workers** (cf. ADR 011): Python — **PydanticAI + Instructor**. Custom
  `CircuitBreaker` + LLM Router adapter + audit trail + hallucination guard
  in `agents/common`.

Three languages, **isolated per service**. No mixing inside a single binary.

## Persistence (cf. ADR 006 + 007)

- **PostgreSQL 17 + pgvector** : operational data ; pyramid graph (recursive CTE
  + JSONB) ; normative RAG embeddings (HNSW). Apache AGE optional Pro+.
- **ClickHouse** : audit trail, telemetry, KPI history.
- **S3-compatible** : evidence blobs (signed PDFs, OSCAL exports).
- **Redis** : LLM response cache + sessions.

## Event bus (cf. ADR 008)

**NATS JetStream** from M1 (NOT deferred to M5+). Subjects prefixed `egide.v1.*`.
Cross-language native (TS + Python + Go). Single binary, ~30 MB RAM.

## Terminology (cf. ADR 012)

- **agent** = `edge/agent` Go binary on customer hosts.
- **AI worker** = Python process running an LLM agent loop in `agents/*`.
- **collector** = third-party API adapter in `services/pipeline/connectors/`.

Don't say "AI agent" in user-facing UI ; say "moteur IA" or be functional.

## Conventions

- Code, comments, commit messages, identifiers: **English**.
- User-facing strings, marketing copy, docs for end users: **French primary**.
- Package managers: `pnpm` (never npm), `uv` (never pip), `go mod`.
- Linting: `biome` (TS), `golangci-lint` (Go), `ruff` + `mypy strict` (Python).
- Commits: `type(scope): description` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.
  Signed (`git commit -S`).
- Branches: `feature/<short>`, `fix/<short>`. Squash merge.
- Tests: every PR adds tests; CI red blocks merge.
- API versioning from v1 (cf. ADR 015). Never ship an unversioned external API.
- Reversible Drizzle migrations (every up has a tested down).

## Front-end identity — mandatory (cf. ADR 017)

The front (`apps/web` and the landing) is part of the product
credibility. Every front-related PR respects:

- **Tokens only** (cf. `docs/design-system.md`): no hard-coded colors,
  no border-radius outside `4/6/8`, no box-shadow elevation, no inline
  fonts.
- **Signature components** in `packages/ui/`: `<AnchorChip>`,
  `<CascadeNode>`, `<EvidenceChain>`, `<ApprovalTrail>`,
  `<ImpactDiff>`, `<FrameworkMatrix>`, `<TraceBreadcrumb>`,
  `<CompiledArtifact>`, `<TerminalReplay>`, `<RegoSyntax>`.
- **Dark mode default**, light mode post-M5.
- **Density Linear-grade** (32px row, not 48px+).
- **No box-shadow**, separation by border or background shift only.
- **Motion budget** ≤ 200ms, ease-out, no infinite/decorative animations.
- **No external CDN** (self-hosted fonts), no third-party tracker
  (Plausible / Umami EU only).

### Anti-AI-slop — visual

Forbidden in any UI or marketing surface:

- Aurora background, mesh gradient, orb glow, beams, sparkles, meteors
- Border radius > 8px
- Box-shadow elevation
- Decorative animation (rotate, float, infinite glow, parallax)
- Icons in colored circles
- 3-column feature card grids without narrative
- Cartoon illustrations (unDraw, Storyset, Blush)
- AI-generated images in production (ever)
- Lottie / Lordicon decorative animations
- Stock shadcn components (button/card/badge as-is)

### Anti-AI-slop — copywriting

Forbidden words/phrases in marketing or UI copy:

- `supercharge`, `unlock`, `seamless`, `intelligent`, `AI-powered`,
  `10x your X`, `transform your X`, `the future of X`,
  `revolutionize`, `next-generation`, `cutting-edge`,
  `enterprise-grade`, `world-class`, `best-in-class`,
  `industry-leading`
- Superlatives without proof ("the most", "the best", "the only")
- "Trusted by 1000+ companies" without those companies
- Fake client logos / "powered by" marquees
- Vague AI claims without measurable backing

Preferred voice: short factual sentences, code samples > adjectives,
exact numbers, honest scope, ADR/RFC links as credibility.

### Anti-tools (front)

Forbidden libraries/services for front (introduce only via ADR):

- LangChain.js (use PydanticAI server-side; client never calls LLM directly)
- Aceternity UI / Magic UI / Skiper UI / Origin UI (extract patterns OK,
  never ship blocks as-is)
- unDraw / Storyset / Blush / Lordicon / LottieFiles
- Guideflow / Navattic / Walnut / HowdyGo (US SaaS, sovereign-incompatible)
- Spline / Three.js (decorative 3D)
- Geist font, Cal Sans, Cabinet Grotesk
- Vercel as production host for landing (sovereign-incompatible —
  use Scaleway Edge or OVH Web)
- Google Analytics, Hotjar, Intercom (use Plausible / self-hosted Umami)

## Security — mandatory rules (cf. ADR 014 + 016)

**Every PR**:
1. No secrets, keys, or credentials in code (gitleaks blocks).
2. Authorization checks reviewed for new endpoints (deny-by-default).
3. Input validation at trust boundaries (parsing, deserialization, prompts).
4. Output sanitization where rendered (HTML, logs, LLM prompts).
5. OWASP Web Top 10 considered (link to ADR 014 §A0X if relevant).
6. OWASP LLM Top 10 considered (link to ADR 014 §LLM0X if LLM-touching).
7. Threat model file added/updated in `docs/threat-models/` (if non-trivial).
8. Audit log entries added for security-relevant actions.

**CI gates** (full-strict from M1):
- semgrep + gosec + ruff-sec + bandit (HIGH/CRITICAL bloquants)
- gitleaks (any secret blocks)
- osv-scanner (HIGH/CRITICAL bloquants)
- trivy fs + image (HIGH/CRITICAL bloquants)
- license audit (allow-list per ADR 016)
- syft SBOM (CycloneDX)
- cosign sign images
- helm lint + kubeconform on Helm charts

**Anti-tools forbidden** (introduce only via new ADR):
- LangChain / LangChain.js (replaced by PydanticAI per ADR 011)
- Temporal (NATS suffices per ADR 008)
- Neo4j (PG recursive CTE suffices per ADR 006)
- Kafka / Redpanda (NATS suffices)
- Elasticsearch (PG tsvector + pgvector replace it)
- MongoDB (no use case)
- HashiCorp Sentinel (BSL ; use CloudFormation Guard / regula)
- CrewAI / AutoGen / DSPy (PydanticAI surclasses)
- Anthropic Agent SDK direct (locks to Claude, breaks ADR 004)

## Editions and licensing

- **Community** under **AGPL-3.0-only**. See `LICENSE`.
- **Professional / Enterprise** under commercial license. See `LICENSE-COMMERCIAL.md`.
- Edition gating happens at runtime via `EGIDE_EDITION` env var and signed
  Ed25519 license key. The repository contains **all** code; commercial
  features are unlocked by license key.
- See `docs/editions.md` for the feature matrix.

## What this repo replaces

Monorepo consolidating two prior personal projects:

| Source | Status | What we keep |
|---|---|---|
| `~/dev/process-pyramid` | Frozen, archive | 10 ontology clusters (`ontologies/clusters/*.yaml`), Drizzle DB schema, 25 deterministic rules (ported to Go) |
| `~/projects/aegis-platform` | Frozen, archive (SOC features) | Python `CircuitBreaker`, pipeline parsers, ClickHouse schema, edge agent skeleton |

Detailed file-by-file plan in `docs/migration.md` (updated 2026-05-05).

## ADR index

- ADR 001 — Foundation (positioning, audience, scope)
- ADR 002 — Licensing (AGPL + commercial dual)
- ADR 003 — Stack (TS + Go + Python) — **amended 2026-05-05**
- ADR 004 — Multi-LLM router with degraded mode — **amended 2026-05-05**
- ADR 005 — Policy-as-Code multi-target — **MVP scope reduction 2026-05-05**
- ADR 006 — Graph persistence (PG recursive CTE + JSONB)
- ADR 007 — RAG normative (pgvector)
- ADR 008 — Job queue (NATS JetStream from M1)
- ADR 009 — Eval framework (custom pytest, Inspect AI later)
- ADR 010 — Approval workflow primitives
- ADR 011 — Agent strategy (super-agent + PydanticAI)
- ADR 012 — Terminology (agents / AI workers / collectors)
- ADR 013 — MVP persona (technical staff + operational RSSI)
- ADR 014 — Security by design (OWASP Web + LLM Top 10)
- ADR 015 — Architectural principles (hexagonal selective + DDD + 12-factor)
- ADR 016 — Secure SDLC (full-strict from M1)
- ADR 017 — Front-end identity and design system

## Front-end docs

- `docs/design-system.md` — tokens + 10 signature components spec
- `docs/landing-blueprint.md` — landing structure + copy + components
- `docs/dashboard-blueprint.md` — dashboard pages + navigation + states

## Lazy-loaded skills (loaded on demand)

@.claude/skills/iso27001-2022.md
@.claude/skills/iso9001-2026.md
@.claude/skills/nis2-directive.md
@.claude/skills/dora-regulation.md
@.claude/skills/itil4-framework.md
@.claude/skills/hds-health-data.md
@.claude/skills/cis-benchmarks.md
@.claude/skills/opa-rego.md
@.claude/skills/kyverno.md
@.claude/skills/ansible.md
@.claude/skills/oscal-structure.md
@.claude/skills/shacl-validation.md
@.claude/skills/bpmn-2-0.md
@.claude/skills/dmn-decision-model.md
@.claude/skills/llm-router-providers.md
@.claude/skills/proxmox-api.md
@.claude/skills/audit-readiness.md
@.claude/skills/pyramid-coherence-rules.md

> Note (cf. ADR 011 + 012): skills mention several "agents" (`ontology-modeler`,
> `policy-generator`, etc.). Per the super-agent strategy (ADR 011 Strategy B),
> these are **tools** of the single `agents/compliance` AI worker, not
> separate agents.

> Note (cf. ADR 003 amendment): `shacl-validation.md` is preserved for
> reference but tagged **post-MVP**. The validator uses Go custom rules
> + recursive CTE at MVP.

## Workflow

`/generate-pyramid "incident management ITIL conforming to NIS2"` →
1. Resolve normative anchors (RAG via pgvector).
2. Generate Policy / Procedure / BPMN / KPI via PydanticAI super-agent tools.
3. Hallucination guard verifies every cited anchor.
4. Run deterministic validator (25 rules, Go, recursive CTE).
5. Run LLM-as-judge for semantic rules (optional, only if AI mode active).
6. Compile selected policies to Rego (MVP) / Ansible (M6+) / etc.
7. Bundle as a verifiable artifact with hash chain (Ed25519 signed in Enterprise).

## Don't do

- No generation without normative anchor (every artifact cites a source control).
- No persistence without coherence validation.
- No silent dependency on a cloud LLM. Every call is logged.
- No lock-in to Anthropic or any single LLM vendor.
- No Visio-like UX (Linear/Notion-grade for devs).
- No "CISO assistant" framing — the MVP persona is technical (sysadmin/DevOps/op RSSI).
- No Sigma rules or kill-chain SOC features. Those live in `aegis-platform`.
- No new external dependency without license check + osv-scanner verification.
- No anti-tool from the forbidden list above without an ADR amendment.
- No PR without OWASP Web + LLM Top 10 checklist consideration.
- No non-trivial feature without a threat model in `docs/threat-models/`.
