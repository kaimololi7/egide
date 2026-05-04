# Egide

> Sovereign GRC platform — from boardroom signature to runtime enforcement.

Egide turns the human chain of governance — directive, policy, procedure, process,
KPI — into a verifiable cascade that **runs**: real OPA, Kyverno, Ansible, CIS, and
cloud rules generated from the same single source of truth.

**Designed for:** RSSI / DSI of mid-sized organizations, regulated sectors (health,
public, finance, industry), and managed-service partners who refuse to send their
governance data to US-cloud SaaS.

## Why Egide

| | Egide | Vanta / Drata | Egerie / Tenacy | Styra / OPA |
|---|---|---|---|---|
| Pyramid N0–N7 (directive → enforcement) | yes | partial | partial | no |
| Policy-as-Code multi-target (Rego + Ansible + Kyverno + CIS + AWS Config) | yes | no | no | OPA only |
| LLM choice (cloud BYOK / sovereign EU / local Ollama) | yes | Anthropic only | none | none |
| Runs offline / air-gapped (Enterprise) | yes | no | no | yes |
| Open source core (AGPL-3.0) | yes | no | no | yes |
| Sovereign EU hosting | yes | no | partial | partial |
| French / EU regulatory packs (NIS2, DORA, HDS, ISO 9001:2026, RGPD) | first-class | partial | yes | none |

## Editions

- **Community** (AGPL-3.0) — single-tenant, all 10 frameworks, BYOK or local LLM, basic
  policy-as-code targets (Rego + Ansible).
- **Professional** — multi-tenant, advanced targets (Kyverno + CEL + AWS Config + Falco),
  continuous compliance, auditor view, cloud connectors.
- **Enterprise** — air-gapped bundle, SSO/SAML, white-label MSSP, signed OSCAL exports,
  SLA, full strategic→executable cascade (J6).

See [`docs/editions.md`](docs/editions.md) for the detailed feature matrix.

## Architecture (high level)

```
┌──────────────────────────────────────┐
│  Web (Next.js 15 + shadcn)           │
└──────────────────┬───────────────────┘
                   │ tRPC
┌──────────────────▼──────────────────────────┐
│  API Gateway (Bun + Hono, TypeScript)        │
└──┬────────┬────────┬────────┬────────────┬──┘
   │        │        │        │            │
   ▼        ▼        ▼        ▼            ▼
Extractor  LLM     Validator Compiler   Edge gateway
(Python)   Router  (Go)      (Go)       (Go)
           (TS)    25 rules  intent →   for J2 agents
                             Rego/Ansi-
                             ble/Kyver-
                             no/CIS

PostgreSQL (operational) + ClickHouse (audit/evidence) + S3 (evidence blobs)
```

See [`docs/architecture.md`](docs/architecture.md).

## Status

Pre-MVP. Public scaffolding only. See [`docs/roadmap.md`](docs/roadmap.md) for the plan.

This project consolidates and replaces two prior personal experiments:
[`process-pyramid`](https://github.com/...) (frontend + ontologies) and
[`aegis-platform`](https://github.com/...) (Go backend + Python agent framework).
See [`docs/migration.md`](docs/migration.md) for what is reused.

## Quick start (when first MVP lands)

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

## License

- Source code: **GNU AGPL-3.0-only** ([LICENSE](LICENSE)).
- Commercial license available for Professional / Enterprise editions —
  see [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).

## Contributing

Contributing guidelines, CLA, and code of conduct will be published before the first
public release. Until then, this is a single-author scaffolding phase.

## Documentation

- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Editions (Community / Professional / Enterprise)](docs/editions.md)
- [Migration plan](docs/migration.md)
- [Architecture Decision Records](docs/adr/)
