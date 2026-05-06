---
name: pyramid-coherence-rules
description: Operational summary of the 50+ coherence rules across 6 families. Loaded by `coherence-validator` and any agent that needs a quick reference to which rule fires when. The full canonical reference is `docs/coherence-rules.md`.
---

# Coherence rules — quick operational reference

Full canonical doc: `docs/coherence-rules.md` (50+ rules, 6 families). This skill is the working memory: rule IDs, severities, fix patterns. Used by every agent during validation/generation.

## Rule families at a glance

| Family | Prefix | Count | Where validated |
|---|---|---|---|
| Structural | S | 12 | SHACL pure |
| Semantic cross-level | C | 15 | SHACL + LLM-as-judge |
| Temporal / versioning | T | 8 | SHACL + DB triggers |
| Governance / RACI | G | 6 | SHACL |
| Audit-readiness | A_<framework>_ | 5 per framework × 5 | LLM + structural |
| Generation quality | Q | 4 | LLM-as-judge |

Total: 50+ active rules.

## Severities

| Severity | Action on failure |
|---|---|
| `error` | Block mutation. User must fix before persistence. |
| `warn` | Persist with flag. Show in UI. Audit log records. |
| `info` | Persist silently. Available in detailed reports. |

Default for structural / cross-level: `error`. Default for audit-readiness: `error` if `publish_intent=true`, else `warn`.

## Top 10 rules cited most in production (estimated)

| Rank | Rule | Family | Severity | Description (one-liner) |
|---|---|---|---|---|
| 1 | C01 | semantic | error | Policy SLA must equal Procedure SLA |
| 2 | S01 | structural | error | Policy must link to ≥1 normative control |
| 3 | S08 | structural | error | BPMN must have exactly 1 start event |
| 4 | C04 | semantic | error | Every BPMN task or output has ≥1 KPI |
| 5 | C08 | semantic | error | KPI threshold ≤ BPMN timer duration |
| 6 | G01 | governance | error | Every artifact has 1 Accountable |
| 7 | C09 | semantic | error | Procedure decision_point → BPMN exclusiveGateway with matching condition |
| 8 | C03 | semantic | error | Procedure actor → BPMN lane |
| 9 | T01 | temporal | error | Mutation creates new version (no in-place edit on published) |
| 10 | Q01 | quality | error | No hallucinated control reference |

## Fix patterns library

When a rule fails, `coherence-validator` returns a `suggested_fix`. Common patterns:

### C01 — SLA misalignment
- **Detect**: Policy.numerical_commitments[i].SLA != Procedure.inherited_from_policy.SLA
- **Fix patterns**:
  - Update Procedure to match Policy SLA (default, safer)
  - Update Policy SLA after risk review (only if explicit user intent)
  - Mark Procedure as exception with documented justification

### S01 — Policy without control
- **Detect**: Policy.linkedToControl == []
- **Fix**: Invoke `ontology-modeler` with policy text to find matching controls; user confirms.

### S08 — Missing BPMN start event
- **Detect**: BPMN parsed has 0 startEvent
- **Fix**: Auto-insert default startEvent connected to the first task.

### C04 — Task without KPI
- **Detect**: BPMN task without inbound link from any KPI's `linked_to.bpmn_node`
- **Fix patterns**:
  - User flags task as "internal, not measured" → exception logged
  - Generate matching KPI via `kpi-designer`
  - Link to existing KPI if semantically equivalent

### G01 — Multiple accountables
- **Detect**: artifact.raci.accountable.count != 1
- **Fix**: Force user to pick exactly one. Log others as `consulted`.

### Q01 — Hallucinated control
- **Detect**: Cited control_id doesn't exist in `ontologies/<framework>/`
- **Fix**: Reject artifact, re-invoke `ontology-modeler` with cleaner query, regenerate with valid anchor.

## Auto-fixable vs manual

| Auto-fixable (with user confirmation) | Manual (requires human judgment) |
|---|---|
| S08 missing start event | C01 SLA conflict (which version is right?) |
| S09 missing end event | G03 RACI A/R conflict |
| C04 task missing KPI | Q01 hallucination root cause |
| C03 missing lane | A_NIS2_02 reporting timeline gap |

`coherence-validator` returns `auto_fixable: true|false` per error. `process-architect` decides batching.

## Performance budget per rule type

| Type | Per-rule cost | Total budget |
|---|---|---|
| Structural SHACL | <2ms | <30ms for 12 rules |
| Cross-level SHACL+SPARQL | <10ms | <150ms for 15 rules |
| LLM-as-judge | 1-3s | 10-30s for 15 semantic rules (parallel) |
| Audit-readiness | 1-2s | 5-10s |

## Caching strategy

LLM-as-judge results cached in Redis on `(mutation_hash, rule_id, ontology_version)`:
- TTL: 24h
- Invalidation: any change to ontology version OR rule definition
- Cache hit ratio target: >70% in steady state

SHACL not cached (cheap to recompute).

## When rules conflict (rare but happens)

E.g., G05 (RACI must propagate) conflicts with explicit user override. Resolution:
1. User override is documented (`raci_override_reason` field).
2. Coherence-validator emits warning but does NOT block.
3. Audit-readiness-checker flags for auditor visibility.

## Relationship to OSCAL

Each rule maps to OSCAL `assessment-objective` if applicable. Future export: SHACL violation → OSCAL POA&M item.

## Reference paths

- `docs/coherence-rules.md` — canonical, full descriptions
- `packages/graph/shapes/` — SHACL implementations
- `packages/llm/judge/rules.py` — LLM-as-judge prompts per rule
- `tests/coherence/` — fixtures per rule

## Don'ts

- Don't add new rules without updating this skill AND `docs/coherence-rules.md`.
- Don't change severity in production silently — versioning required (T07).
- Don't bypass rules even for "simple" cases — structural integrity is non-negotiable.
- Don't return raw SHACL output to users — translate to actionable language.
