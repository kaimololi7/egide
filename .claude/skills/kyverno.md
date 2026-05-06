# Kyverno — Operational guidance

Kyverno (CNCF graduated) is a Kubernetes-native policy engine. Unlike Rego,
its policies are themselves Kubernetes CRDs (YAML), making them auditable by
existing K8s tooling. Egide's compiler emits Kyverno as a Professional-tier
target.

## When Kyverno fits

| Scenario | Kyverno fit |
|---|---|
| K8s admission control with mutation | excellent (mutate is native) |
| K8s validation (block bad resources) | excellent |
| K8s resource generation (e.g., default NetworkPolicy) | excellent |
| Cleanup of stale resources | excellent (TTL policies) |
| Cross-cluster, multi-cloud, non-K8s | use Rego/OPA instead |

Kyverno is K8s-only by design. If the customer's enforcement target is purely
Kubernetes, Kyverno is often simpler than Rego because policies are YAML and
match K8s resource conventions.

## Egide convention

Compiled Kyverno policies are `ClusterPolicy` resources with metadata
linking back to Egide:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: egide-db-backup-required
  annotations:
    egide.io/intent-id: intent_db_backup_required
    egide.io/intent-version: "1.2.0"
    egide.io/pyramid-artifact: policy_data_protection_v3
    egide.io/normative-anchor: "iso27001-2022:A.8.13"
    egide.io/severity: error
spec:
  validationFailureAction: Enforce  # or Audit per intent.severity
  background: true
  rules:
    - name: production-db-must-have-backup
      match:
        any:
          - resources:
              kinds:
                - StatefulSet
                - postgres.crunchydata.com/v1beta1/PostgresCluster
              selector:
                matchLabels:
                  egide.io/criticality: "high"
      validate:
        message: "Production databases must have backup enabled"
        pattern:
          spec:
            backup:
              enabled: true
              frequencyHours: "<=24"
```

## Compiler responsibilities (services/compiler/generators/kyverno)

For each TAI Intent compiled to Kyverno:

1. Map `intent.selector.kinds` → `match.any[].resources.kinds[]`.
2. Map `intent.selector.scope` (production/staging/dev) → label match
   `app.kubernetes.io/instance` or `argocd.argoproj.io/instance`.
3. Map `intent.required_state[]` → `validate.pattern` or `validate.deny`.
4. Map `intent.severity`:
   - `error` → `validationFailureAction: Enforce`
   - `warn` → `validationFailureAction: Audit`
   - `info` → emit `policyReports` only (set `background: true`, no enforce)
5. Map `intent.actions_on_violation[]`:
   - `audit` → `validate` only
   - `block_deployment` → `validate` with `Enforce`
   - `auto_remediate` → `mutate` rule generated alongside
   - `notify_owner` → integrate Kyverno with PolicyReports + external webhook

## Mutation (auto-remediation)

Where the customer wants auto-remediation:

```yaml
mutate:
  patchStrategicMerge:
    spec:
      backup:
        enabled: true
        frequencyHours: 24
```

Egide is **conservative** about mutation: by default, generators do not emit
`mutate` rules unless `intent.actions_on_violation` includes
`auto_remediate`. Mutation in production is risky; we ask explicit consent.

## Testing — kyverno CLI

The compiler emits a test file per policy:

```yaml
# tests/test-egide-db-backup-required.yaml
name: test-db-backup-required
policies:
  - egide-db-backup-required.yaml
resources:
  - resources.yaml  # Production DB with backup enabled
results:
  - policy: egide-db-backup-required
    rule: production-db-must-have-backup
    resource: prod-db-1
    kind: PostgresCluster
    result: pass
  - policy: egide-db-backup-required
    rule: production-db-must-have-backup
    resource: prod-db-2-no-backup
    kind: PostgresCluster
    result: fail
```

Run via: `kyverno apply egide-db-backup-required.yaml --resource resources.yaml`.

The compiler's `Test()` method shells out to the `kyverno` CLI bundled in the
service container.

## Distribution

Kyverno policies are deployed via:

- **Argo CD / Flux** — GitOps; Egide pushes to a Git repo per tenant.
- **Helm chart** — Egide produces a chart with all active policies.
- **Direct `kubectl apply`** — for small clusters.

Egide signs the Helm chart (Enterprise) and verifies on apply via cosign.

## Reporting

Kyverno emits `PolicyReport` and `ClusterPolicyReport` CRs. Egide's pipeline
service ingests these via K8s API watch (J2 + J4) and stores findings in
ClickHouse for the continuous compliance dashboard.

## Don'ts

- Don't emit `mutate` without explicit Intent consent.
- Don't use `validate.deny` with complex JMESPath unless `validate.pattern`
  cannot express the rule.
- Don't generate policies that match `*` resources without scope filters
  (CPU pressure on admission controller).
- Don't bypass Kyverno engine version compatibility — pin in compiler output.

## Reference paths

- `services/compiler/generators/kyverno/` — generator (Go)
- `services/compiler/internal/kyverno_runner.go` — wraps `kyverno apply` and `kyverno test`
- Upstream: <https://kyverno.io/docs/>
- Policy catalog: <https://kyverno.io/policies/>

## Versions to track

- Kyverno engine v1.13+
- kyverno CLI v1.13+
- Kubernetes API: 1.28+ for full feature support
