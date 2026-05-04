# Egide — Claude Code config

Sovereign GRC platform that converts the **human chain of governance** (directive → policy
→ procedure → process → KPI) into a **verifiable, executable cascade**: real Rego,
Kyverno, Ansible, CIS, and cloud-policy rules generated from the same single source of
truth.

**Buyer**: RSSI / DSI of EU mid-sized organizations (200–2000 employees), regulated
sectors (health, public, finance, industry), and managed-service partners who refuse
to send their governance data to US-cloud SaaS.

**Position**: anti-Vanta. Open core. Air-gappable. Multi-LLM with choice (BYOK / EU
sovereign / local Ollama / no AI at all).

## Non-negotiable principles

1. **Strategic-to-executable cascade is the moat**. Every artifact must trace upward
   to a signed directive AND downward to one or more enforcement rules. No
   orphan policies. No standalone Rego.
2. **Degraded mode without AI is mandatory** in Community edition. Templates +
   deterministic validator must produce a usable pyramid without any LLM call.
3. **Multi-LLM router** is built-in from day 1. No tenant is locked to Anthropic
   or to any single provider. Local Ollama / vLLM is a first-class option.
4. **Policy-as-Code is multi-target**, not Rego-only. Ansible (on-prem), Kyverno
   (K8s), CIS Benchmarks (audit), AWS Config / Azure Policy / Scaleway IAM (cloud),
   Falco (runtime). One intent, many compilations.
5. **Sovereignty by design**. Default deployment options favor EU clouds
   (Scaleway, OVH) and on-prem (Proxmox). Air-gapped Enterprise is fully supported.
6. **Pyramid coherence is enforced**. Mutations propagate or are rejected. Every
   change is versioned, hashed, and traceable to an OSCAL evidence trail.

## Stack (firm — see ADR 003)

- **Frontend**: Next.js 15 (App Router, RSC, Server Actions) + Tailwind v4 + shadcn/ui.
- **API gateway**: Bun + Hono, TypeScript, tRPC for typed contracts.
- **Validator service**: Go — ports the deterministic 25-rule engine from
  `process-pyramid` to native Go for performance and shared runtime with the
  policy compiler.
- **Policy compiler**: Go — the moat. Compiles a normalized Intent into Rego /
  Kyverno / Ansible / CIS / cloud-policy artifacts.
- **Pipeline**: Go — log/event ingestion (parsers from `aegis-platform`).
- **Datalake**: Go — ClickHouse for audit trail and evidence storage.
- **Edge agent**: Go — cross-platform, mTLS, posture collection (base from
  `aegis-platform`, refactored for GRC).
- **Doc extractor (J1)**: Python — Unstructured / Docling / pypdf for parsing
  the customer's existing PDFs / Word / Markdown.
- **AI agents**: Python — `BaseAgent` framework ported from `aegis-platform`,
  adapted for multi-LLM routing.

Three languages, **isolated per service**. No mixing inside a single binary.

## Conventions

- Code, comments, commit messages, identifiers: **English**.
- User-facing strings, marketing copy, documentation for end users: **French
  primary**, English second.
- Package managers: `pnpm` (never npm), `uv` (never pip), `go mod`.
- Linting: `biome` (TS), `golangci-lint` (Go), `ruff` + `mypy strict` (Python).
- Commits: `type(scope): description` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.
- Branches: `feature/short`, `fix/short`.
- Tests: every PR adds tests; CI red blocks merge.

## Editions and licensing

- **Community** under **AGPL-3.0-only**. See `LICENSE`.
- **Professional / Enterprise** under commercial license. See `LICENSE-COMMERCIAL.md`.
- Edition gating happens at runtime via `EGIDE_EDITION` env var and
  feature-flag checks. The repository contains **all** code; commercial
  features are unlocked by license key.
- See `docs/editions.md` for the feature matrix.

## What this repo replaces

This monorepo consolidates two prior personal projects:

| Source | Status | What we keep |
|---|---|---|
| `~/dev/process-pyramid` | Frozen, archive | 10 ontology clusters (`ontologies/clusters/*.yaml`), Drizzle DB schema, 25 deterministic rules (ported to Go) |
| `~/projects/aegis-platform` | Frozen, archive (SOC features) | Python `BaseAgent` framework, pipeline parsers, ClickHouse schema, edge agent skeleton |

Detailed file-by-file plan in `docs/migration.md`.

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

(Skills will be migrated from `process-pyramid/.claude/skills/` and adapted as we
rebuild the corresponding services.)

## Workflow

`/generate-pyramid "incident management ITIL conforming to NIS2"` →
1. Resolve normative anchors (ontology + RAG).
2. Generate Policy / Procedure / BPMN / KPI.
3. Run deterministic validator (25 rules, Go).
4. Run LLM-as-judge for semantic rules (optional, only if AI mode active).
5. Compile selected policies to chosen targets (Rego / Ansible / Kyverno / CIS).
6. Bundle as a verifiable artifact with hash chain.

## Don't do

- No generation without normative anchor (every artifact cites a source control).
- No persistence without coherence validation.
- No silent dependency on a cloud LLM. Every call is logged with provider/model.
- No lock-in to Anthropic or any single LLM vendor.
- No Visio-like UX (Notion-like / Linear-like only).
- No "CISO assistant" framing — the buyer is RSSI/DSI of EU mid-market, with a
  technical-meets-governance need that current tools (Vanta, Egerie, Styra)
  do not address jointly.
- No Sigma rules or kill-chain SOC features. Those live in `aegis-platform`.
