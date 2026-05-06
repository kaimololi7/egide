# Target-agnostic Intent (TAI) — Specification draft v0.1

> Status: **Draft v0.1**. First stable spec (v1.0) lands when the policy
> compiler ships the Rego generator at MVP (M5 — cf. ADR 005 amendment).
> Ansible target arrives at M6 with possible v1.1 refinements.
>
> Last update: 2026-05-05.

The TAI is the intermediate representation that connects the **human pyramid**
(directive → policy → procedure → process → KPI) to the **executable artifacts**
(Rego, Kyverno, Ansible, CIS, AWS Config, Falco, Sentinel).

A pyramid artifact (a "policy" in the pyramid) can carry one or more Intents.
Each Intent compiles to a set of artifacts, one per requested target.

## Goals

1. **Target-agnostic**: no Intent hard-codes Kubernetes, Ansible, or AWS.
2. **Lossless trace**: every Intent points to its source pyramid artifact and
   normative anchor (e.g., `iso27001-2022:A.8.32`).
3. **Severity-aware**: `error` blocks; `warn` audits; `info` records.
4. **Composable**: multiple Intents can compose; a parent Intent can specialize
   children.
5. **Testable**: every Intent ships canonical fixtures (positive + negative).
6. **Versioned**: an Intent has a stable ID, a content hash, and an evolution
   history.

## Schema (JSON, draft)

```json
{
  "$schema": "https://egide.io/schema/tai-intent/v0.1.json",
  "id": "intent_db_backup_required",
  "version": "1.2.0",
  "title": "Production databases must have backup enabled",
  "description": "Every database flagged as production-class must have an active backup configuration that runs at most every 24 hours.",
  "selector": {
    "kinds": ["database"],
    "scope": "production",
    "labels": { "egide.io/criticality": ["high", "critical"] },
    "exceptions": [
      { "kind": "database", "name": "ephemeral-test-rw" }
    ]
  },
  "required_state": [
    { "path": "backup.enabled", "op": "==", "value": true },
    { "path": "backup.frequency_hours", "op": "<=", "value": 24 },
    { "path": "backup.retention_days", "op": ">=", "value": 30 }
  ],
  "actions_on_violation": ["audit", "block_deployment", "notify_owner"],
  "severity": "error",
  "source_trace": {
    "pyramid_artifact_id": "policy_data_protection_v3",
    "normative_anchors": [
      "iso27001-2022:A.8.13",
      "nis2:Art.21.2.c"
    ],
    "directive_id": "directive_2026_q1_signed_dg",
    "directive_signature_hash": "sha256:abcd1234..."
  },
  "target_hints": {
    "rego": { "package": "egide.policies.db.backup", "decision": "deny" },
    "kyverno": { "policyType": "ClusterPolicy", "validationFailureAction": "Audit" },
    "ansible": { "module": "community.postgresql.postgresql_set", "tags": ["backup"] },
    "cis": { "section": "5.6.1", "level": 1 },
    "aws_config": { "ruleType": "RDS_BACKUP_ENABLED" }
  },
  "fixtures": {
    "positive": [
      { "name": "compliant prod db", "data": { "backup": { "enabled": true, "frequency_hours": 24, "retention_days": 60 } }, "expect": "allow" }
    ],
    "negative": [
      { "name": "no backup", "data": { "backup": { "enabled": false } }, "expect": "deny" },
      { "name": "weekly backup", "data": { "backup": { "enabled": true, "frequency_hours": 168 } }, "expect": "deny" }
    ]
  },
  "metadata": {
    "owner": "rssi@example.com",
    "created_at": "2026-05-04T10:00:00Z",
    "updated_at": "2026-05-04T10:00:00Z",
    "content_hash": "sha256:efgh5678..."
  }
}
```

## Field reference

### `id`
Stable identifier inside a tenant. Format: `intent_<snake_case>`. Required.

### `version`
SemVer. Bumped on any field change. Required.

### `selector`
Defines which resources this Intent applies to.

- `kinds`: required. Array of resource kinds. Egide normalizes kinds across
  targets (e.g., `database`, `compute`, `storage`, `network_interface`,
  `iam_user`, `secret`). The compiler maps generic kinds to target-specific
  resource types.
- `scope`: optional. One of `production`, `staging`, `development`, or a
  custom string. Maps to namespace/account labels per target.
- `labels`: optional. Map of label/tag key to acceptable values.
- `exceptions`: optional. Resources that explicitly do not match.

### `required_state`
Array of assertions. Each assertion has:
- `path`: dot-notation path through the resource state tree.
- `op`: comparison operator (`==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not_in`, `regex_match`).
- `value`: expected value (literal or array for `in`).

All assertions must pass for the resource to be compliant. Conjunctive only;
for OR semantics, split into multiple Intents or use a custom `any_of` block
(future extension).

### `actions_on_violation`
Array of action keywords. Targets translate to native actions:

| Action | Rego | Kyverno | Ansible | AWS Config |
|---|---|---|---|---|
| `audit` | `decision == "deny"` with `enforce: false` | `validationFailureAction: Audit` | log to ansible audit | `EVALUATION` |
| `block_deployment` | admission `deny` | `validationFailureAction: Enforce` | `failed_when` blocks playbook | not applicable |
| `notify_owner` | external webhook | external | mail handler | SNS topic |
| `auto_remediate` | not supported | `mutate` rule | `ansible-playbook` runs fix | Config remediation |

### `severity`
- `error`: violation blocks the workflow (admission, deploy, audit).
- `warn`: violation is recorded but allowed.
- `info`: passive observation only.

### `source_trace`
Required. Every Intent must trace upward.

- `pyramid_artifact_id`: ID of the policy/procedure that owns this Intent.
- `normative_anchors`: array of anchor IDs (`<framework>:<ref>`).
- `directive_id`: the signed directive that cascaded into this policy.
- `directive_signature_hash`: cryptographic hash binding to the signature event.

### `target_hints`
Optional. Per-target overrides. The compiler uses sensible defaults if absent.

### `fixtures`
Test cases with positive (compliant) and negative (violating) examples. Each
fixture provides data and the expected verdict (`allow` or `deny`). The
compiler runs these against the generated artifact via the native engine
(`opa eval`, `kyverno apply`, `ansible-playbook --check`, etc.).

### `metadata`
Bookkeeping: owner email, timestamps, hash.

## Compilation contract

For each target T, the generator produces an `Artifact`:

```ts
interface Artifact {
  intentId: string;
  intentVersion: string;
  target: "rego" | "kyverno" | "ansible" | "cis" | "aws_config" | "azure_policy" | "scaleway_iam" | "gcp_org_policy" | "falco" | "terraform_sentinel";
  format: "yaml" | "rego" | "json" | "hcl" | "bash";
  content: string;             // The actual artifact body
  signature?: string;           // Ed25519 signature (Enterprise)
  testReport: TestReport;       // Output of running fixtures
  generatedAt: string;          // ISO timestamp
  compilerVersion: string;
  contentHash: string;
}
```

## Composability (future)

A parent Intent can declare children:

```json
{
  "id": "intent_data_protection_master",
  "children": [
    { "id": "intent_db_backup_required" },
    { "id": "intent_db_encryption_at_rest" },
    { "id": "intent_db_logging_enabled" }
  ]
}
```

Composition rules (TBD): conjunction by default; explicit `any_of` for OR.

## Reverse compilation (later, P3+)

Parsing an existing Rego or Ansible playbook into one or more Intents is a
hard problem (akin to AST → semantic recovery). It is on the roadmap for
M12+. The Intent format is designed so that a partial recovery is still
useful: a recovered Intent without `required_state` but with valid
`source_trace` is recordable as an "imported" Intent.

## Open questions (resolved or deferred for v0.2 / v1.x)

| # | Question | v0.2 stance | Rationale |
|---|---|---|---|
| 1 | OR semantics (`any_of` block) | **In v0.2** | Half of compliance rules are "A or B suffices" ; cannot ship without |
| 2 | Cross-resource references (e.g., "every DB must have on-call subscriber") | **Deferred to v1.1** | Pushes toward graph query language ; needs design work |
| 3 | Time-windowed assertions ("every Monday 02:00 UTC") | **Deferred to v1.1** | Useful for KPIs but expressible via cron + audit log for now |
| 4 | `transform` block for target-specific code injection | **Rejected** | Mini-DSL within DSL ; use custom generator plugin instead |
| 5 | Streaming compilation events (progress per generator) | **In v0.2** | UX requirement for the technical persona (cf. ADR 013) |
| 6 | Signed Intent IR documents | **In v1.0** | Alignment with audit chain ; Ed25519 in Enterprise (ADR 014) |

## CLI invocation (cf. ADR 013)

The technical persona uses the CLI :

```bash
# Generate compiled Rego from an Intent
egide compile rego --intent intent_db_backup_required --output bundles/

# Run fixtures against the compiled artifact
egide compile test --intent intent_db_backup_required --target rego

# Validate a TAI Intent against the schema
egide intent validate path/to/intent.json

# Inspect intent → artifact provenance
egide intent show intent_db_backup_required --with-artifacts

# List intents stale due to upstream pyramid mutation
egide intent list --status stale
```

CLI parity with web UI is mandatory.

## Versioning the spec itself

The spec is versioned as a JSON Schema at `https://egide.io/schema/tai-intent/v0.X.json`.
Breaking changes require a major bump. The compiler must support reading every
published major version (compat layer).
