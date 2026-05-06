---
name: itil4-framework
description: ITIL 4 reference layer — 34 management practices grouped in 3 categories. Loaded when generating, validating, or auditing pyramids that target ITIL 4. Points to `ontologies/itil4/` for verbatim content; this skill is operational guidance only.
---

# ITIL 4 — Operational guidance

ITIL 4 is published by AXELOS / PeopleCert. The framework structures around the **Service Value System (SVS)** and **34 management practices**. This skill is the operational pointer for `process-architect`, `policy-generator`, and `audit-readiness-checker` — the canonical content lives in `ontologies/itil4/practices.ttl`.

## Practice categories

### General Management Practices (14)
Architecture management · Continual improvement · Information security management · Knowledge management · Measurement and reporting · Organizational change management · Portfolio management · Project management · Relationship management · Risk management · Service financial management · Strategy management · Supplier management · Workforce and talent management

### Service Management Practices (17)
Availability management · Business analysis · Capacity and performance management · Change enablement · Incident management · IT asset management · Monitoring and event management · Problem management · Release management · Service catalogue management · Service configuration management · Service continuity management · Service design · Service desk · Service level management · Service request management · Service validation and testing

### Technical Management Practices (3)
Deployment management · Infrastructure and platform management · Software development and management

## Service Value Chain activities

Plan · Improve · Engage · Design and Transition · Obtain/Build · Deliver and Support

Every Policy generated for ITIL must declare which SVC activity it primarily serves.

## Key invariants

1. **Practices are not processes**. A practice describes capabilities, resources, principles. Policy (N1) implements a practice; Procedure (N2) operationalizes capabilities; BPMN (N3) is the executable expression.
2. **Continual improvement is mandatory** — every pyramid targeting ITIL must include CI loops in KPIs (`pdca_loop` field non-empty).
3. **Practice value chain links** — each practice connects to upstream/downstream practices. The pyramid must declare these in `compliance-matrix`.

## Most-requested practices in mid-market FR ETI

Based on discovery hypotheses for our trajectory A:

| Rank | Practice | Why frequent | Typical KPIs |
|---|---|---|---|
| 1 | Change Enablement | NIS2 + ISO 27001 A.8.32 driver | Lead time, change failure rate, RFC backlog |
| 2 | Incident Management | NIS2 Art. 23 + customer-facing | MTTR, incident count by category, SLA breach rate |
| 3 | Service Request Management | High volume, automation candidate | Self-service rate, fulfillment time |
| 4 | Problem Management | Recurring incidents → root cause | Problems opened, recurrence rate |
| 5 | Service Configuration Management | Source of truth for assets | CI accuracy, audit findings |

## Cross-framework relationships

| ITIL 4 practice | Maps to | Notes |
|---|---|---|
| Change Enablement | ISO 27001:2022 A.8.32 + NIS2 21.2.f | Directly aligned |
| Information security management | ISO 27001 (entire) | Subset → use ISO 27001 directly for cybersec |
| Incident management | NIS2 Art. 21.2.b + Art. 23 | Reporting timelines must propagate |
| Service continuity management | DORA Chap. 4 + ISO 22301 | DORA mandatory for fin services |
| Risk management | DORA + NIS2 Art. 21.2.a | Cross-link evidence trail |

## Reference paths

- `ontologies/itil4/practices.ttl` — RDF entities (one per practice)
- `ontologies/itil4/shacl-rules.ttl` — ITIL-specific SHACL constraints
- `ontologies/itil4/version.json` — current version (4.1+)
- `ontologies/itil4/svs.ttl` — Service Value System graph

## When to load

Auto-loaded by `cultural-localizer`-equivalent (process-architect) when `target_frameworks` contains "ITIL 4" or any ITIL practice ID. Otherwise lazy.

## License note

ITIL is a trademark of PeopleCert. Authoritative text is copyrighted. Authoritative paragraphs in `ontologies/itil4/` come from licensed access (PeopleCert dataset agreement) — not bundled with the open-source distribution. Tenants must declare their ITIL license to unlock verbatim paragraph retrieval.
