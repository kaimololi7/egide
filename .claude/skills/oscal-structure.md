---
name: oscal-structure
description: OSCAL (Open Security Controls Assessment Language) reference. Sub-jacent to the pyramid for traceability and audit export. NOT exposed in MVP UX — used internally by `compliance-mapper` for SSP-ready exports. Loaded when audit/export features are touched.
---

# OSCAL — Operational guidance

OSCAL = NIST Open Security Controls Assessment Language. JSON/XML/YAML standard for representing security catalogs, profiles, components, and assessments. We use it as the **export format** for compliance traceability — auditors increasingly accept OSCAL.

## OSCAL model layers

```
Catalog (e.g., NIST SP 800-53, ISO 27001)
   ↓ tailored by
Profile (subset / overlay)
   ↓ implemented by
Component Definition (what a software component implements)
   ↓ in
System Security Plan (SSP) — your system + its controls
   ↓ assessed via
Assessment Plan → Assessment Results → Plan of Action & Milestones (POA&M)
```

For our use case (mid-market ETI, ISO 27001:2022 / ITIL / NIS2), the relevant layers are **Catalog**, **Profile**, **Component Definition**, **SSP**.

## Mapping pyramid → OSCAL

| Pyramid artifact | OSCAL layer |
|---|---|
| Normative ontology (ISO 27001 Annex A) | Catalog |
| Tenant SoA (which controls in scope) | Profile |
| Pyramid (Policy + Procedure + BPMN + KPI) | Component Definition + SSP |
| Coverage matrix (`compliance-mapper`) | SSP `by-component-statement` |
| Audit reports | Assessment Results |

## Why OSCAL is sub-jacent (not exposed in MVP)

The persona "responsable qualité ETI" doesn't know OSCAL exists. Selling OSCAL → confusion. But:
1. Auditors want machine-readable evidence → OSCAL is the answer.
2. Future US-DoD, NIST, FedRAMP-aligned customers expect OSCAL.
3. Exporting OSCAL is a button at audit time, no UX impact daily.

So: build the OSCAL data model **under the hood**, expose only at export time.

## Tooling

- **trestle** (Python, NIST IBM) — OSCAL CLI + library, mature
- **OSCAL-react** — UI components if we ever build a viewer
- **oscal-schemas** — JSON schemas for validation

## Minimal SSP example (JSON)

```json
{
  "system-security-plan": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "metadata": {
      "title": "Acme ETI ISO 27001 ISMS",
      "last-modified": "2026-04-30T14:00:00Z",
      "version": "1.0",
      "oscal-version": "1.1.2"
    },
    "import-profile": {
      "href": "#iso27001-profile-acme"
    },
    "system-characteristics": {
      "system-name": "Acme ICT environment",
      "description": "Manufacturing ETI 350 employees",
      "security-sensitivity-level": "moderate"
    },
    "control-implementation": {
      "implemented-requirements": [
        {
          "uuid": "...",
          "control-id": "iso27001-2022:A.8.32",
          "by-components": [
            {
              "component-uuid": "policy-P-001",
              "uuid": "...",
              "description": "Policy P-001 §4 implements A.8.32 §1-3"
            },
            {
              "component-uuid": "procedure-PR-001",
              "uuid": "...",
              "description": "Procedure PR-001 §5 details operational steps"
            }
          ]
        }
      ]
    }
  }
}
```

## Generation pattern

`compliance-mapper` produces a structured matrix → `packages/oscal/serializer.py` converts to OSCAL JSON → `trestle validate` confirms schema → user downloads.

```python
from packages.oscal import to_ssp

ssp_json = to_ssp(
    pyramid=pyramid,
    coverage_matrix=matrix,
    profile_id="iso27001-profile-acme",
)
trestle.validate(ssp_json)  # raises on schema violation
write("exports/oscal/PY-001-ssp.json", ssp_json)
```

## Catalog management

We pre-build OSCAL Catalogs for:
- ISO 27001:2022 (93 controls + clauses) — `ontologies/iso27001-2022/oscal-catalog.json`
- ITIL 4 (34 practices) — adapted to OSCAL Catalog format (NIST officially supports any framework)
- NIS2 (Articles 21, 23) — bespoke OSCAL Catalog
- DORA (5 chapters) — bespoke

Profiles are tenant-specific, generated at SoA time.

## Versioning

OSCAL has built-in versioning via `metadata.version` and `metadata.last-modified`. We mirror our pyramid version into OSCAL versions to keep traceability.

## Phase 3 extension: policy-as-code

Once core product stable, we can derive Rego (OPA) or Kyverno from:
1. SHACL coherence rules → declarative validations
2. OSCAL implementation requirements → enforcement policies
3. Procedure §5 numerical constraints → runtime checks

NOT in MVP. Kept on the roadmap because OSCAL is the natural pivot point.

## Reference paths

- `packages/oscal/serializer.py` — pyramid → OSCAL
- `packages/oscal/parser.py` — OSCAL → internal model (for re-import)
- `packages/oscal/validators.py` — schema + cross-references
- `ontologies/*/oscal-catalog.json` — pre-built catalogs

## Don'ts

- Don't expose OSCAL terminology in user-facing UI ("SSP", "POA&M" → confusing).
- Don't generate OSCAL until `compliance-mapper` has produced its matrix.
- Don't bypass schema validation — invalid OSCAL exports lose customer trust.
- Don't merge OSCAL profiles across tenants (license + isolation).
