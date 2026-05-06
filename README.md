# Egide

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-full--strict-success)](.github/workflows/ci.yml)
[![ADRs](https://img.shields.io/badge/ADRs-17-informational)](docs/adr/)
[![Threat models](https://img.shields.io/badge/threat--models-4-informational)](docs/threat-models/)
[![Stack](https://img.shields.io/badge/stack-TS%20%7C%20Go%20%7C%20Python-lightgrey)](docs/architecture.md)
[![Sovereign](https://img.shields.io/badge/hosting-EU%20%2B%20air--gappable-darkgreen)](docs/adr/001-foundation.md)

> **From a signed directive to a Rego rule blocking a non-compliant Pod.**
>
> Open-source GRC that compiles your governance into runnable policies.
> Sovereign EU. Air-gappable. Bring your own LLM, or none at all.

Egide turns the human chain of governance — directive, policy, procedure, process,
KPI — into a verifiable cascade that **runs**: real OPA Rego (Ansible at M6,
Kyverno / CIS / AWS Config later) generated from the same single source of truth.

**Built for**: technical staff "forced" into GRC — sysadmin, DevOps, SRE, security
engineer who finds themselves wearing the GRC hat — and operational RSSI of EU
PME / ETI 50–500. CLI first-class. Self-hostable. Sovereign. Air-gappable.

**Position**: the open-core anti-Vanta. Refuses the trade-off the market accepts
between governance documentation tools (Vanta, Egerie, Drata) and runtime
enforcement engines (Styra, OPA). Egide unifies both — without sending your data
to a US cloud.

## Why Egide

| | Egide | Vanta / Drata | Egerie / Tenacy | Styra / OPA |
|---|---|---|---|---|
| Pyramid (directive → enforcement) | yes | partial | partial | no |
| Policy-as-Code multi-target (Rego today, Ansible/Kyverno/CIS/cloud later) | yes | no | no | OPA only |
| LLM choice (cloud BYOK / sovereign EU / local Ollama / no AI at all) | yes | Anthropic only | none | none |
| Runs offline / air-gapped (Enterprise) | yes | no | no | yes |
| Open source core (AGPL-3.0) | yes | no | no | yes |
| Sovereign EU hosting | yes | no | partial | partial |
| First-class CLI | yes | no | no | yes |
| French / EU regulatory packs (ISO 27001, NIS2, DORA, HDS, RGPD, ISO 9001) | first-class | partial | yes | none |

## Editions

- **Community** (AGPL-3.0) — single-tenant, all 6 frameworks, BYOK or local LLM,
  Rego compiler at MVP (Ansible at M6, more later).
- **Professional** — multi-tenant, advanced compiler targets (Kyverno + CIS +
  AWS Config + Falco), continuous compliance, auditor view, cloud collectors.
- **Enterprise** — air-gapped Proxmox VM bundle, SSO/SAML, white-label MSSP,
  signed OSCAL exports, SLA, full strategic→executable cascade with directive
  signature workflow.

See [`docs/editions.md`](docs/editions.md) for the detailed feature matrix and
when each compiler target lands per the roadmap.

## Architecture (high level)

```
┌──────────────────────────────────────┐  ┌────────────────┐
│  Web (Next.js 15, RSC, shadcn)       │  │  CLI (Bun)     │
│                                      │  │  egide ...     │
└──────────────────┬───────────────────┘  └────────┬───────┘
                   │ tRPC                          │
┌──────────────────▼──────────────────────────────────────┐
│  API Gateway (Bun + Hono + tRPC, Better-Auth)           │
│  - LLM Router (per-tenant config)                        │
│  - 5 bounded contexts (pyramid / compilation / etc.)     │
└──┬────────┬────────┬────────┬──────────────────┬────────┘
   │        │        │        │                  │
   ▼        ▼        ▼        ▼                  ▼
Extractor  AI       Validator Compiler        Edge gateway
(Python    workers  (Go,      (Go, hex.)      (Go) — mTLS
 Docling)  Pydantic hex.)     Rego at MVP     to tenant agents

NATS JetStream message bus (egide.v1.*) — cross-language native

PostgreSQL 17 + pgvector (operational + RAG) +
ClickHouse (audit) + S3 (evidence blobs) + Redis (cache)
```

See [`docs/architecture.md`](docs/architecture.md) and
[`docs/architecture-principles.md`](docs/architecture-principles.md).

## Security posture

Egide is itself a security product. We hold ourselves to:

- **OWASP Web Top 10 (2021)** + **OWASP LLM Top 10 (2025)** mapping with
  concrete controls : [`docs/adr/014-security-by-design.md`](docs/adr/014-security-by-design.md).
- **SAST + SCA + signing + SBOM full-strict from M1** :
  [`docs/adr/016-secure-sdlc.md`](docs/adr/016-secure-sdlc.md).
- **Threat models per non-trivial feature** in
  [`docs/threat-models/`](docs/threat-models/).
- **Multi-tenant isolation** at app layer + Postgres RLS + tenant-scoped
  queries everywhere.
- **No data sent to LLM in `privacy_mode: strict`** — local providers only.

See [`docs/security.md`](docs/security.md) for the operational guide.

## Status

**M5 closing → M6 ramp-up.** ~16 kLOC of source across TS + Go + Python ;
full J1 pipeline livré (extraction → classification → anchors → drafting →
validation → persistence) ; Rego compiler with 5 production controls ;
Ansible target with Molecule scenarios ; OSCAL SSP export ; Better-Auth +
RLS + Helm chart shipped.

See [`STATUS.md`](STATUS.md) for the per-sprint changelog and
[`docs/roadmap.md`](docs/roadmap.md) for the long-form plan.

This project consolidates and replaces two prior personal experiments:
[`process-pyramid`](https://github.com/...) (frontend + ontologies) and
[`aegis-platform`](https://github.com/...) (Go backend + Python framework).
See [`docs/migration.md`](docs/migration.md).

## Quick start

```bash
git clone https://github.com/egide/egide.git
cd egide
cp .env.example .env
docker compose -f deploy/docker/compose.yaml up -d
pnpm install
pnpm dev
```

Egide runs **without any AI key** in template-only mode — so you can demo the full
pyramid before deciding on an LLM provider.

CLI:

```bash
egide pyramid generate --frameworks iso27001,nis2 --input docs/
egide compile rego <intent-id>
egide approval list --pending
```

Full end-to-end demo (drop docs → pyramid → Rego bundle → k3d sandbox
rejecting a bad Deployment) :

```bash
./scripts/e2e-demo.sh             # end-to-end with k3d
./scripts/e2e-demo.sh --no-k3d    # offline OPA eval only
./scripts/e2e-demo.sh --teardown  # remove cluster + compose stack
```

Walk-through tutorials live in [`docs/tutorials/`](docs/tutorials/).

## License

- Source code: **GNU AGPL-3.0-only** ([LICENSE](LICENSE)).
- Commercial license available for Professional / Enterprise editions —
  see [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).

## Contributing

Contributing guidelines, DCO, threat model template, and code of conduct will be
published before the first public release (M6). Until then, this is a single-author
scaffolding phase.

## How we build it

Differentiator nobody else publishes:

- **17 ADRs publicly tracked** — every architectural decision justified
  and reviewable. [Browse them →](docs/adr/)
- **OWASP Web Top 10 (2021) + LLM Top 10 (2025)** explicitly mapped to
  controls in [ADR 014](docs/adr/014-security-by-design.md).
- **Threat models per non-trivial feature** in
  [`docs/threat-models/`](docs/threat-models/).
- **Sovereign tooling** — NATS over Kafka, PostgreSQL + pgvector over
  Elasticsearch, PydanticAI over LangChain, Scaleway / OVH over Vercel.
- **Full SBOM** (CycloneDX) per release. cosign-signed images. ko
  reproducible Go builds.
- **AGPL-3.0 core + DCO** — no CLA, no license ping, self-host freely.

## Documentation

- [Architecture](docs/architecture.md)
- [Architecture principles](docs/architecture-principles.md)
- [Security overview](docs/security.md)
- [Threat models](docs/threat-models/)
- [Design system](docs/design-system.md)
- [Landing page blueprint](docs/landing-blueprint.md)
- [Dashboard blueprint](docs/dashboard-blueprint.md)
- [Roadmap](docs/roadmap.md)
- [Editions matrix (Community / Professional / Enterprise)](docs/editions.md)
- [Migration plan](docs/migration.md)
- [Architecture Decision Records (17)](docs/adr/)
- [TAI Intent IR spec](docs/specs/intent-ir.md)
