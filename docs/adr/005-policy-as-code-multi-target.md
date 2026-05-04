# ADR 005 — Policy-as-Code multi-target compiler

- **Status**: Accepted
- **Date**: 2026-05-04
- **Deciders**: solo founder

## Context

The defining moat is the ability to compile a **single normalized Intent**
into multiple **enforcement artifacts** that run on heterogeneous infrastructure.

A policy authored as "every production database must have backup enabled"
must compile to:

- **Rego / OPA Gatekeeper** for Kubernetes admission control.
- **Kyverno** ClusterPolicy for native K8s enforcement.
- **Ansible playbook** for on-prem servers (RDBMS configuration).
- **CIS Benchmark** check for periodic audit.
- **AWS Config Rule** (or **Azure Policy** / **GCP Org Policy** / **Scaleway IAM**)
  for cloud-side detection.
- **Falco rule** for runtime detection of disabled backup.
- (Eventually) **Terraform Sentinel** for IaC-time enforcement.

No competitor does this multi-target compilation:

- **Styra DAS** — Rego only.
- **Kyverno** — Kyverno only.
- **HashiCorp Sentinel** — Terraform only.
- **AWS Config** — AWS only.
- **Ansible Lightspeed** — Ansible only.

The fragmentation is the customer's pain. Egide's promise is to absorb it.

## Decision

### Intent intermediate representation

Every policy is represented in a **Target-agnostic Intent (TAI)** — a JSON
structure that captures:

- **Resource selector**: kind, namespace/scope, labels/tags.
- **Required state**: assertions over resource fields.
- **Required actions**: mutations or notifications when state diverges.
- **Severity**: `error` blocks; `warn` audits; `info` records.
- **Source trace**: pyramid artifact ID, normative anchor (e.g., ISO 27001 A.8.32),
  signing parent (which directive cascaded into this policy).
- **Target hints**: optional per-target overrides (e.g., specific Rego style).

Example:

```json
{
  "id": "intent_db_backup_required",
  "selector": { "kind": "database", "scope": "production" },
  "required_state": { "backup.enabled": true, "backup.frequency_hours": "<=24" },
  "actions": { "on_violation": ["audit", "block_deployment"] },
  "severity": "error",
  "source_trace": {
    "pyramid_artifact": "policy_data_protection_v3",
    "normative_anchor": "iso27001-2022:A.8.13",
    "directive_id": "directive_2026_q1_signed_dg"
  }
}
```

### Compilation pipeline

`services/compiler` (Go) implements:

```
Intent (TAI) ──▶ Validator (TAI well-formed?) ──▶ Target Selector ──▶ N Generators ──▶ N Artifacts
                                                       │
                                                       ▼
                                                Rego, Kyverno, Ansible,
                                                CIS, AWS Config, Falco
                                                Sentinel (later)
```

Each generator is a Go package implementing `Generator` interface:

```go
type Generator interface {
    Name() string
    SupportsIntent(i Intent) bool
    Compile(ctx context.Context, i Intent) (Artifact, error)
    Test(ctx context.Context, a Artifact, fixtures []Fixture) (TestReport, error)
}
```

### Targets per edition

| Target | Community (AGPL) | Professional | Enterprise |
|---|---|---|---|
| Rego / OPA | yes | yes | yes |
| Ansible | yes | yes | yes |
| Kyverno | no | yes | yes |
| CIS Benchmark | no | yes | yes |
| AWS Config | no | yes | yes |
| Azure Policy | no | yes | yes |
| Scaleway IAM | no | yes | yes |
| Falco | no | yes | yes |
| Terraform Sentinel | no | no | yes |
| Custom DSL via plugin | no | no | yes |

The Community edition gets the two highest-impact targets (Rego covers cloud-native
K8s, Ansible covers on-prem). This ensures the open-source product is genuinely
useful, not crippleware.

### Testing each artifact

Every compiled artifact ships with **canned test fixtures** (positive + negative).
A `Test()` call runs the artifact against fixtures using the native engine:

- Rego → `opa eval`
- Kyverno → `kyverno apply`
- Ansible → `ansible-playbook --check` against a sandbox
- CIS → static rule simulation
- AWS Config → AWS policy simulator (or local mock)
- Falco → falco unit-test mode

A failing fixture blocks publication of that artifact. A user override
(documented exception) bypasses the block but is logged.

### Versioning and signing

- Each artifact carries the source pyramid hash + Intent hash + compiler version.
- Enterprise edition signs artifacts with the tenant's Ed25519 key.
- An artifact whose source pyramid mutates is automatically marked as `stale`
  and recompiled.

### Reverse direction (planned, P3+)

The compiler is currently one-way (Intent → artifacts). We intend (deferred)
to also support:

- **Audit-by-existing**: ingest an existing Rego or Ansible playbook and
  attempt to recover an Intent for inclusion in the pyramid. Useful for J1
  customers with existing IaC. Hard problem; LLM-assisted; experimental.

## Consequences

- The compiler is **the** strategic component. It must be exceptionally well
  tested. Target the same care as a compiler-front-end project (parse, AST,
  lower, optimize, emit).
- We accept that some targets are imperfect at MVP (e.g., Falco rules will be
  templated rather than fully synthesized). The compiler is extensible per
  target, so quality can rise per release without breaking the pyramid.
- Adding a new target is **a Go package**, not a service. Lowers contribution
  bar for the community.
- We must publish a **public spec for the Intent IR** so contributors can
  build new generators. This becomes part of `docs/specs/`.
- The Intent IR is **not** OSCAL. OSCAL is for evidence/SSP serialization; TAI
  is for compilation targets. They coexist.
