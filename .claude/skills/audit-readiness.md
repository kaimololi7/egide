---
name: audit-readiness
description: Audit-readiness checklists per target framework. Loaded by `audit-readiness-checker` and `compliance-mapper`. Encodes what an external auditor expects to see for ISO 27001:2022, ISO 9001:2026, ITIL 4, NIS2, DORA.
---

# Audit-readiness — Operational checklists per framework

When `publish_intent=true`, `audit-readiness-checker` runs framework-specific checklists. This skill provides the authoritative checklists. Each item maps to a rule `A_<framework>_<num>` in the canonical `docs/coherence-rules.md`.

## ISO 27001:2022 readiness (5 checks)

| ID | Check | Mandatory? | Auto-detectable? |
|---|---|---|---|
| A_ISO27_01 | All in-scope Annex A controls have ≥1 covering Policy | Yes | Yes (graph traversal) |
| A_ISO27_02 | Statement of Applicability (SoA) generated, signed, dated < 12 months | Yes | Yes |
| A_ISO27_03 | Each control has evidence trail (artifact + KPI + audit log) | Yes | Yes |
| A_ISO27_04 | Risk register OSCAL exists, links risks ↔ controls | Yes | Yes |
| A_ISO27_05 | PDCA continual improvement plan dated < 12 months | Yes | Yes |

Plus ISMS clauses 4-10 evidence:
- Context of organization (4) — interested parties + scope documented
- Leadership (5) — policy signed, RACI clear
- Planning (6) — risk treatment plan present
- Support (7) — competence + awareness records
- Operation (8) — operational planning evidence
- Performance evaluation (9) — internal audit + management review minutes
- Improvement (10) — nonconformity register + corrective actions

## ITIL 4 readiness (4 checks)

| ID | Check |
|---|---|
| A_ITIL_01 | Each declared practice has Policy + Procedure + BPMN + KPIs |
| A_ITIL_02 | Practice value chain links to upstream/downstream practices |
| A_ITIL_03 | Service Value System (SVS) documented for in-scope practice |
| A_ITIL_04 | Continual improvement register maintained |

ITIL is less prescriptive than ISO — auditors here are usually internal certification bodies (PeopleCert) or consulting reviews, not regulatory.

## ISO 9001:2026 readiness (6 checks)

| ID | Check |
|---|---|
| A_ISO9_01 | QMS scope and boundaries declared |
| A_ISO9_02 | Process approach: inputs/outputs/interactions documented per process |
| A_ISO9_03 | Risk-based thinking visible per process |
| A_ISO9_04 | Customer focus measurable in ≥1 KPI per process |
| A_ISO9_05 | PDCA loop populated for every KPI |
| A_ISO9_06 | Management review cadence ≥ annual, documented |

Plus 2026-specific:
- Climate change context addressed (Clause 4)
- Process interactions diagram exportable

## NIS2 readiness (4 checks)

| ID | Check | Severity |
|---|---|---|
| A_NIS2_01 | Article 21.2 measures (10 categories) all addressed | error if essential entity |
| A_NIS2_02 | Article 23 reporting timelines (24h/72h/1mo) procedurally implemented | critical |
| A_NIS2_03 | Supply chain security included if essential entity | high |
| A_NIS2_04 | Management body accountability documented (sanctions risk) | error |

Notification timeline test (must be procedurally executable):
- T+0: incident detection
- T+24h: early warning to CSIRT-FR (procedure must trigger this within window)
- T+72h: detailed notification
- T+1 month: final report

## DORA readiness (4 checks)

| ID | Check |
|---|---|
| A_DORA_01 | ICT risk management framework documented + signed by board |
| A_DORA_02 | Incident classification (major vs significant) + reporting procedures |
| A_DORA_03 | Operational resilience testing plan (basic annual + TLPT triennial if applicable) |
| A_DORA_04 | Third-party ICT risk register present, Art. 30 clauses-types in contracts |

## How agents use this skill

`audit-readiness-checker` orchestrates:
1. Load this skill + the relevant `<framework>` skill
2. Walk the pyramid graph
3. For each check: detect status (covered/gap/out_of_scope)
4. Aggregate severity, recommend publish/block

`compliance-mapper` uses the checks to populate `audit_readiness` field of the matrix.

## Severity escalation rules

```python
def overall_recommendation(checks: list[Check]) -> str:
    if any(c.severity == "critical" and c.failed for c in checks):
        return "block"
    if any(c.severity == "high" and c.failed for c in checks):
        return "block_unless_justified"
    if sum(1 for c in checks if c.failed and c.severity == "medium") > 2:
        return "conditional"
    if all(c.passed or c.scope == "out" for c in checks):
        return "go"
    return "review"
```

## Common audit findings (per framework, from real-world experience)

### ISO 27001 — most frequent NCs
1. SoA outdated (>12 months) — A_ISO27_02
2. Risk register doesn't link to all implemented controls — A_ISO27_04
3. Control effectiveness review absent — A_ISO27_05
4. Internal audit cycle gap — Clause 9.2

### NIS2 — most critical
1. Reporting timelines theoretical, never tested — A_NIS2_02
2. Management body unaware of sanctions personnelles — A_NIS2_04
3. Supply chain risk register missing — A_NIS2_03

### DORA — early adopters
1. CTPP register missing or incomplete — A_DORA_04
2. TLPT plan absent for entities required — A_DORA_03
3. Board signature absent on framework — A_DORA_01

## Cross-framework optimization

When multiple frameworks share evidence (e.g., ITIL Change Enablement + ISO 27001 A.8.32 + NIS2 21.2.f), the same artifact covers all three. `compliance-mapper` deduplicates the evidence trail to avoid auditor confusion.

## Reference paths

- `packages/audit/checklists/<framework>.yaml` — machine-readable checklists
- `packages/audit/runner.py` — execution engine
- `tests/audit/` — fixtures per framework

## Don'ts

- Don't approve a publish if any critical check fails — escalate to user.
- Don't confuse out_of_scope with gap — out_of_scope is documented exclusion (acceptable), gap is missing coverage (fix needed).
- Don't certify the artifact yourself — your role is to detect, the auditor certifies.
