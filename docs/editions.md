# Egide — Editions matrix

Three editions sharing **one codebase**. Edition gating happens at runtime via
`EGIDE_EDITION` env and signed license key (Ed25519). See ADR 002.

## At a glance

| | Community | Professional | Enterprise |
|---|---|---|---|
| License | AGPL-3.0-only | Commercial | Commercial |
| Indicative price | free | 5–15K€/year | 30–100K€/year |
| Buyer | self-hosters, contributors, evaluators | PME 50–300, junior cabinets | ETI 200–2000, regulated sectors, MSSP |
| Hosting | self-hosted | self-hosted or Egide Cloud | self-hosted, including air-gapped |
| Tenants per install | 1 | up to 5 | unlimited |
| Support | community Discord | email 48h | 24/7 SLA |
| LLM choice | BYOK + local Ollama | + EU sovereign providers | + bundled Mistral 7B for air-gapped |
| Updates | community releases | quarterly + security | quarterly + security + offline channel |

## Detailed feature matrix

### Pyramid (the core)

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Pyramid N0–N5 (frameworks → policy → procedure → BPMN → KPI) | yes | yes | yes |
| 10 EU regulatory packs (ISO 27001, ISO 9001, NIS2, DORA, ITIL, CIS, SOC 2 lite, GDPR, HDS, RGPD) | yes | yes | yes |
| 25 deterministic coherence rules | yes | yes | yes |
| LLM-as-judge for semantic rules (15 additional) | no | yes | yes |
| SHACL advanced validation | no | yes | yes |
| Strategic→executable cascade with directive signature (J6) | no | no | yes |
| OSCAL export | no | yes (unsigned) | yes (signed, hash-chained) |

### Onboarding (J1 — drop docs)

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Document extraction (PDF / Word / Markdown) | basic (template-only fallback if no AI) | full LLM-assisted | full + custom extractors |
| Gap analysis vs framework | manual checklist | LLM-augmented | LLM + cabinet review |
| Redundancy detection | no | yes | yes |
| Bulk import (multiple folders) | no | yes | yes |

### Policy-as-Code compiler (J3 — the moat)

| Target | Community | Pro | Enterprise |
|---|---|---|---|
| Rego / OPA Gatekeeper | yes | yes | yes |
| Ansible playbooks | yes | yes | yes |
| Kyverno | no | yes | yes |
| CIS Benchmarks | no | yes | yes |
| AWS Config rules | no | yes | yes |
| Azure Policy | no | yes | yes |
| Scaleway IAM | no | yes | yes |
| GCP Org Policy | no | yes | yes |
| Falco runtime detection | no | yes | yes |
| Terraform Sentinel | no | no | yes |
| Custom DSL plugins | no | no | yes |
| Per-target test fixtures + auto-validation | yes | yes | yes |
| Artifact signing (Ed25519) | no | no | yes |

### LLM Router (J8)

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Anthropic BYOK | yes | yes | yes |
| Mistral La Plateforme BYOK | yes | yes | yes |
| OpenAI-compatible BYOK | yes | yes | yes |
| Ollama (self-hosted) | yes | yes | yes |
| vLLM (self-hosted) | yes | yes | yes |
| LM Studio (self-hosted) | yes | yes | yes |
| Scaleway AI / OVH AI Endpoints | no | yes | yes |
| Per-task routing config | no | yes | yes |
| Budget caps + cost reporting | no | yes | yes |
| **Template-only mode (no AI required)** | **yes** | yes | yes |
| Bundled local LLM in install image | no | no | yes (Mistral 7B / Qwen 14B) |

### Inventory and posture (J2)

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Manual asset registry | yes | yes | yes |
| CSV import | yes | yes | yes |
| Edge agent (Linux/Win/Mac) | 1 host | up to 50 hosts | unlimited |
| Proxmox API connector | no | yes | yes |
| Ansible inventory reflection | no | yes | yes |
| AWS / Azure / Scaleway / OVH read-only | no | yes | yes |
| Continuous compliance + drift detection (J4) | no | yes | yes |
| Slack / Teams / email alerts | no | yes | yes |

### Audit and evidence (J5)

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Internal evidence browser | yes | yes | yes |
| Auditor read-only sharing link | no | yes | yes |
| Auditor comments and feedback | no | yes | yes |
| Signed snapshots (hash chain) | no | yes | yes |
| OSCAL SSP export | no | yes | yes |
| Multi-period audit trail | last 30 days | last 1 year | unlimited |

### Multi-tenant and white-label (J7)

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Multi-tenant | no (single tenant) | up to 5 tenants | unlimited |
| Cabinet/MSSP console (consolidated view) | no | basic | full |
| White-label (logo, colors, domain) | no | logo only | full |
| Resale billing | no | no | yes |

### Auth and access

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Email + password | yes | yes | yes |
| OAuth (GitHub, Google) | yes | yes | yes |
| SSO via Supabase | no | yes | yes |
| SAML 2.0 / OIDC enterprise SSO | no | no | yes |
| SCIM provisioning | no | no | yes |
| RBAC (admin / process_owner / auditor / operator / viewer) | basic (3 roles) | full (5 roles) | full + custom |

### Deployment

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Docker Compose | yes | yes | yes |
| Helm chart | yes | yes | yes |
| Egide Cloud (managed) | no | yes | yes |
| Air-gapped Proxmox image | no | no | yes |
| Offline update channel | no | no | yes |
| Backup and restore tooling | basic | full | full + DR runbook |

### Action execution (J9 — apply Ansible real)

| Feature | Community | Pro | Enterprise |
|---|---|---|---|
| Dry-run only | yes | yes | yes |
| Apply with manual approval | no | yes | yes |
| Approval workflow (multi-approver) | no | no | yes |
| Execution audit trail with rollback | no | basic | full |
| Sandboxed test environment | no | optional | included |

### Support

| | Community | Pro | Enterprise |
|---|---|---|---|
| Documentation | yes | yes | yes |
| Discord / Matrix | yes | yes | yes |
| Email support | no | 48h business hours | 24h business hours |
| Phone support | no | no | yes (24/7) |
| Named CSM | no | no | yes |
| Onboarding workshop | no | optional (paid) | included |
| Indemnification | no | optional | included |

## Edition gating implementation

```ts
// packages/llm-router/src/edition.ts
export type Edition = "community" | "professional" | "enterprise";

export const FEATURE_REQUIREMENTS: Record<string, Edition> = {
  "compiler.kyverno": "professional",
  "compiler.cis": "professional",
  "compiler.aws_config": "professional",
  "compiler.terraform_sentinel": "enterprise",
  "directive.signature_workflow": "enterprise",
  "audit.signed_snapshots": "professional",
  "deploy.air_gapped": "enterprise",
  // ...
};

export function requireFeature(feature: string, edition: Edition): void {
  const required = FEATURE_REQUIREMENTS[feature];
  if (!required) return;
  if (compareEditions(edition, required) < 0) {
    throw new EditionUpgradeRequired(feature, required);
  }
}
```

When a `EditionUpgradeRequired` error reaches the UI, the user sees a clear
message ("This feature is part of Egide Professional. [Learn more]") with a
deeplink to the pricing page. We do not hide the feature; the user knows it
exists and what it costs.
