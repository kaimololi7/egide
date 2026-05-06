# Tutorial 2 — From a policy to Rego + Ansible

You already have a pyramid generated (cf. [Tutorial 1](01-iso27001-nis2-from-ansible.md)).
This tutorial focuses on the **policy → Intent IR → Rego + Ansible**
pipeline so you understand exactly what the compiler does, and how to
extend it.

## 0. Read the IR spec

Skim [`docs/specs/intent-ir.md`](../specs/intent-ir.md) first. The
Intent IR is the single artefact every compiler target consumes.

## 1. Pick or author a policy

Either reuse `backup-and-recovery` from Tutorial 1, or author a fresh
one in the web UI :

1. Open `http://localhost:3000/pyramids/<id>`.
2. Click **Add policy** under any directive.
3. Title, body, anchored controls, severity, selector (kinds + scope).
4. Save → the validator runs the 25 coherence rules ; if any fail you
   see the failing rule + offending node.

## 2. Look at the generated IR

```sh
egide intent show --pyramid <pyramid-id> --policy backup-and-recovery
```

Example output :

```yaml
id: intent_db_backup_required
version: 1.0.0
title: Production databases must have backup enabled
selector:
  kinds: [database]
  scope: production
required_state:
  - {path: backup.enabled, op: eq, value: true}
  - {path: backup.frequency_hours, op: lte, value: 24}
actions_on_violation: [audit, block_deployment]
severity: error
source_trace:
  pyramid_artifact_id: policy_data_protection_v3
  normative_anchors: [iso27001-2022:A.8.13, nis2:Art.21.2.c]
fixtures:
  positive:
    - name: compliant prod db
      data: {backup: {enabled: true, frequency_hours: 24}}
      expect: allow
  negative:
    - name: no backup
      data: {backup: {enabled: false}}
      expect: deny
```

## 3. Compile to Rego

```sh
egide compile rego --intent intent_db_backup_required --out ./bundle.rego
```

Look at the file :

- Package `egide.intent_db_backup_required`.
- `default deny := []`.
- One `deny` rule per assertion in `required_state`.
- Comments carrying the `source_trace` (intent id, anchors, severity).

Run the bundled fixtures :

```sh
egide compile test --target rego --intent intent_db_backup_required
```

You should see `3/3 fixtures pass`.

## 4. Compile to Ansible + Molecule

```sh
egide compile ansible --intent intent_db_backup_required --out ./ansible/
cd ansible && molecule test
```

Molecule runs the playbook against two Docker hosts :
- `egide-positive` seeded with the positive fixture data → audit succeeds.
- `egide-negative` seeded with the negative fixture data → audit fails
  with severity `error` (the playbook ends in a `fail` task).

## 5. Wire to your enforcement layer

- Rego → load the bundle into your existing OPA / Gatekeeper /
  Conftest pipeline. The CI gate is one `opa eval` call.
- Ansible → run the playbook with `--tags egide,audit` for read-only
  audit, `--tags egide,remediate -e apply_remediation=true` if you've
  customised the remediation hook.

## 6. Round-trip safety

When the policy changes (someone edits it in the web UI), the validator
re-runs and the compiler re-emits both Rego + Ansible with a new
`source_trace.pyramid_artifact_id`. The `ContentHash` changes ; OSCAL
exports re-issue a new SSP version. Drift is impossible by construction.

## What you've validated

- ✅ One Intent IR → two enforcement artefacts
- ✅ Same fixtures exercise both targets
- ✅ Pyramid edits propagate deterministically to compiled output
- ✅ No LLM in the compile path (compiler is pure deterministic Go)
