# OPA / Rego — Operational guidance

Open Policy Agent (CNCF graduated) is a general-purpose policy engine. Rego
is its declarative policy language. Egide's compiler emits Rego as one of
its primary targets (Community-tier).

## When Rego fits in the Egide compiler

| Use case | Rego fit |
|---|---|
| Kubernetes admission control (Gatekeeper, OPA Gateway) | excellent |
| API gateway authorization (Envoy, Istio) | excellent |
| Terraform plan validation (`conftest`, `regula`) | very good |
| CI/CD step approval | good |
| Application authorization | good but consider OpenFGA / Cerbos |
| Cloud config audit | use cloud-native (AWS Config / Azure Policy) — Rego possible but heavy |

If the customer's only target is K8s natively, Kyverno is often simpler;
Rego shines when policies cross multiple data sources.

## Rego in 30 seconds

```rego
package egide.policies.db.backup

default allow := false

allow if {
    input.resource.kind == "database"
    input.resource.scope == "production"
    input.resource.spec.backup.enabled == true
    input.resource.spec.backup.frequency_hours <= 24
}

deny[msg] {
    input.resource.kind == "database"
    input.resource.scope == "production"
    not input.resource.spec.backup.enabled
    msg := sprintf("Database %v in production must have backup enabled", [input.resource.metadata.name])
}
```

Egide convention:

- Package path: `egide.policies.<domain>.<intent_ref>`
- Two top-level rules: `allow` (boolean default false) + `deny[msg]` (set of strings).
- Input shape: standardized `{resource: {kind, scope, labels, spec, metadata}}`
  matching the TAI selector schema.

## Compiler responsibilities (services/compiler/generators/rego)

For each TAI Intent compiled to Rego, the generator:

1. Maps `intent.selector.kinds` → guards on `input.resource.kind`.
2. Maps `intent.selector.scope` → guard on `input.resource.scope`.
3. Maps each `intent.required_state[]` → an `allow` predicate using
   path traversal (`input.resource.spec.<path>`) and the operator translation
   table below.
4. Generates a corresponding `deny[msg]` rule with a human-readable message
   citing the source pyramid artifact and normative anchor.
5. Generates `_test.rego` files using Intent fixtures.

Operator translation:

| TAI op | Rego |
|---|---|
| `==` | `==` |
| `!=` | `!=` |
| `<` `<=` `>` `>=` | same |
| `in` | `in {...}` (set membership, OPA v0.34+) |
| `not_in` | `not (x in {...})` |
| `regex_match` | `regex.match("pattern", value)` |

## Testing — `opa eval` and `opa test`

The compiler emits `_test.rego` for fixtures:

```rego
package egide.policies.db.backup

test_compliant_prod_db {
    allow with input as {"resource": {"kind": "database", "scope": "production",
                                       "spec": {"backup": {"enabled": true, "frequency_hours": 24}}}}
}

test_no_backup_denied {
    deny["Database prod-1 in production must have backup enabled"] with input as
        {"resource": {"kind": "database", "scope": "production",
                      "metadata": {"name": "prod-1"},
                      "spec": {"backup": {"enabled": false}}}}
}
```

Validation: `opa test pkg/`. The compiler's `Test()` method shells out to the
`opa` binary embedded in the service container.

## Bundles and distribution

For production, bundle artifacts as `.tar.gz` with a `manifest.json`:

```json
{
  "revision": "egide-2026-05-04-T12:00",
  "roots": ["egide/policies/db/backup"],
  "metadata": {
    "intent_id": "intent_db_backup_required",
    "intent_version": "1.2.0",
    "pyramid_artifact": "policy_data_protection_v3"
  }
}
```

Bundles are signed (Enterprise) and pushed to:
- OPA bundle server (HTTP)
- S3-compatible object store
- OCI registry (modern OPA distribution)

## Interaction with Kyverno

If the customer targets both, the compiler emits Rego AND Kyverno from the
same Intent. They are not redundant: Rego covers admission for non-K8s
targets (API gateway, Terraform), Kyverno is K8s-native and supports
mutation. See `.claude/skills/kyverno.md`.

## Don'ts

- Don't generate Rego that requires `data.x.y.z` external lookups in MVP.
  Stay with `input`-only policies; introduce `data` in M5+ once the bundle
  format includes auxiliary data.
- Don't rely on `partial evaluation` — keep policies fully evaluable.
- Don't put business identifiers in package names (use `intent_ref`).

## Reference paths

- `services/compiler/generators/rego/` — Rego generator (Go)
- `services/compiler/generators/rego/templates/` — text templates
- `services/compiler/internal/opa_runner.go` — wraps `opa test` and `opa eval`
- `docs/specs/intent-ir.md` — TAI source format
- Upstream: <https://www.openpolicyagent.org/docs/latest/>

## Versions to track

- OPA: latest stable v1.x; min v0.55 for `import future.keywords`
- conftest: v0.55+
- gatekeeper: v3.16+
- regula (Terraform): v3.x
