# Egide — Roadmap

> Solo founder, patient horizon. Correctness over speed. The plan favors a
> deeply defensible product over a fast-shipped commodity.

**Last updated**: 2026-05-04
**Current state**: Phase M0 (scaffolding + decisions, this commit).

## North star

By M12: a **public open-source release** under AGPL-3.0 with a working MVP
covering **J1 (drop docs)**, **J3 (multi-target policy compiler)**, and
**J8 (LLM router)**, plus 3–5 paid Enterprise design partners. ARR target
50–150K€ at M12.

## Phases

### M0 — Foundation (4 weeks, **current**)

**Goal**: gravé the decisions and scaffold the monorepo. No application code yet.

| Deliverable | Status |
|---|---|
| Monorepo structure (`apps`, `services`, `agents`, `edge`, `packages`, `ontologies`, `deploy`, `docs`) | done |
| Root manifests (package.json, go.work, pyproject.toml, turbo.json) | done |
| ADRs 001–005 (foundation, licensing, stack, LLM router, multi-target compiler) | done |
| README, CLAUDE.md, LICENSE (AGPL-3.0), LICENSE-COMMERCIAL.md | done |
| `docs/architecture.md`, `docs/roadmap.md`, `docs/editions.md`, `docs/migration.md` | done |
| TAI Intent IR public spec draft (`docs/specs/intent-ir.md`) | pending |
| First skill files migrated (`.claude/skills/`) | pending |
| Trademark check for "Egide" / "Égide" in EU | pending |

### M1–M3 — MVP J1 + J3 + J8 (12 weeks)

**Goal**: a demoable product that drops docs, generates a pyramid, and compiles
selected policies into Rego + Ansible. LLM router supports BYOK Anthropic +
local Ollama at minimum. Template-only mode works without any AI key.

#### Sprint S1–S2 (M1, weeks 1–2)
- `packages/db` — Drizzle schema (port from `process-pyramid`).
- `apps/api` — Bun + Hono + tRPC scaffolding, auth (Supabase), health check.
- `packages/llm-router` — interface + Anthropic + Ollama implementations.
- `apps/web` — minimal shell, login, dashboard placeholder.
- Docker Compose dev environment (Postgres + ClickHouse + Redis + Ollama).

#### Sprint S3–S5 (M1–M2, weeks 3–6)
- `services/extractor` — Python service with Unstructured + Docling + pypdf.
  Endpoint: `POST /extract` returns structured JSON.
- `agents/common` — port `BaseAgent` from `aegis-platform`, wire to LLM router.
- `agents/compliance` — first real implementation: ingest extracted JSON,
  classify against ISO 27001 + NIS2, produce a draft pyramid.
- `services/validator` — port the 25 deterministic rules from
  `process-pyramid` Python to Go. All 55 tests pass in Go.
- `apps/web` — drop-zone UI, pyramid viewer (read-only), gap highlights.

#### Sprint S6–S9 (M2–M3, weeks 7–10)
- `services/compiler` — Go scaffolding, Intent IR types, generator interface.
- `services/compiler/generators/rego` — first generator: 5 controls.
  Output validated by `opa eval` against fixtures.
- `services/compiler/generators/ansible` — second generator: same 5 controls
  in Ansible playbooks. Output validated by `ansible-playbook --check`.
- `apps/web` — compiler viewer with syntax highlighting (Shiki) and "Test"
  button that runs the artifact against fixtures.

#### Sprint S10–S12 (M3, weeks 11–13)
- `apps/web` — landing page redesign (post-positioning) Vanta-grade.
- Pricing page (Community / Professional / Enterprise placeholders).
- Public demo video (Loom 4 min: drop docs → pyramid → compile policy → test).
- Outreach: 10 prospects (RSSI/DSI EU mid-market), 3 cabinets, 2 hosters
  (Scaleway / OVH partner programs).

**Exit criteria M3**:
- Loom demo recorded and shared.
- Internal demo: drop a 14-PDF folder → pyramide visible → 1 compiled Rego
  policy that blocks a non-conforming K8s deployment in a sandbox.
- 0 critical bugs on golden path.

### M4 — Public open-source release (4 weeks)

| Deliverable | Why |
|---|---|
| GitHub public repo, README polished, demo GIF | Maximize Show HN / Reddit / Hacker News exposure |
| `CONTRIBUTING.md`, DCO, Code of Conduct | Open-source hygiene |
| Helm chart for K8s install | Sovereign cloud hosters |
| Docker Compose one-liner install | Solo evaluators |
| Tutorial: "Generate ISO 27001 pyramid in 10 min" | Onboarding |
| Tutorial: "Compile your charter to Rego" | Show the moat |
| 5 frameworks ready (ISO 27001, ISO 9001, NIS2, DORA, CIS Controls) | Coverage |
| Show HN post, /r/sysadmin post, /r/cybersecurity post | Discovery |
| Discord or Matrix community channel | Engagement |

**Exit criteria M4**: 100+ GitHub stars in 2 weeks post-launch, ≥10 Discord/Matrix
members, ≥3 unsolicited installation reports.

### M5–M6 — J2 (agent + Proxmox connector) + Professional edition unlock

| Deliverable | Notes |
|---|---|
| `edge/agent` — port from `aegis-platform`, refactor for GRC posture | Cross-platform binary signed |
| Proxmox API connector (services/pipeline) | Differentiator vs Vanta |
| Ansible inventory reader | On-prem essential |
| AWS / Azure / Scaleway / OVH read-only connectors | Cloud breadth |
| Professional edition feature flags + license check | Revenue gate |
| Stripe Checkout + license key issuance | Self-serve Pro |

**Exit criteria**: 3 paying Pro customers (5–15K€/year each).

### M7–M8 — J4 (continuous compliance) + J5 (auditor view)

- Drift detection with daily diff vs validated pyramid.
- Slack / email / Teams notifications.
- Auditor read-only space with comments and signed export bundle (OSCAL).
- 2 cabinet partners signed.

### M9–M10 — Enterprise edition

| Deliverable | Notes |
|---|---|
| Air-gapped bundle (Proxmox VM image + offline package repo) | Pre-quantified Mistral 7B included |
| SSO / SAML / OIDC integrations | Enterprise gate |
| White-label MSSP mode | Cabinet partner channel |
| 24/7 SLA support tier | Pricing justified |
| Signed OSCAL exports with hash chain | Audit-grade evidence |

**Exit criteria**: 1 Enterprise customer signed (≥30K€/year).

### M11–M12 — J9 (apply Ansible real) + J6 (strategic→executable)

- Ansible runner with dry-run-first + approval workflow + execution audit.
- Directive interview wizard for DGs (J6).
- COMEX dashboard: cascade visibility, intent-vs-runtime gap.
- Public release v1.0.

**Exit criteria M12**:
- 5–10 paying customers (mix of Community + Pro + Enterprise).
- ARR 50–150K€.
- 500+ GitHub stars.
- Featured in 1 EU cybersec publication (LeMagIT, MISC, etc.).

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
