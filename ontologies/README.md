# Egide — Ontologies

This directory contains the normative ontology used by the validator and the
policy compiler. Each cluster groups conceptually-equivalent requirements
across multiple frameworks.

## Layout

```
ontologies/
├── README.md
├── registry.yaml             # Top-level index, framework metadata, cluster references
└── clusters/                 # 10 curated clusters (will grow)
    ├── incident-management.yaml
    ├── change-management.yaml
    ├── risk-management.yaml
    ├── document-control.yaml
    ├── awareness-training.yaml
    ├── business-continuity.yaml
    ├── supplier-management.yaml
    ├── internal-audit.yaml
    ├── management-review.yaml
    └── continual-improvement.yaml
```

## Cluster format

A cluster YAML file contains:

- `id`, `label_fr`, `label_en`, `category`, `priority`, `description_*`
- `framework_anchors`: list of `{framework, ref, weight, objective, obligation_*}`
- `strictest_rules`: cross-framework conflict resolution
- `typical_artifacts`: skeleton for `Policy`, `Procedure`, `BPMN`, `KPI`

The `services/validator` consumes these for the deterministic generation path
(template-only mode), and the `services/compiler` reads anchors to trace
each compiled artifact back to its normative source.

## Provenance

Migrated from `~/dev/process-pyramid/ontologies/` on 2026-05-04. Curated
content unchanged; only `registry.yaml` header refreshed for Egide.

## Adding a new cluster

1. Create a new file `clusters/<slug>.yaml` following the schema of an existing one.
2. Add `- $ref: "./clusters/<slug>.yaml"` under the `clusters:` key in `registry.yaml`.
3. Add `cluster:<slug>` in `cluster_order:` at the right priority.
4. Make sure each `framework_anchors[].ref` actually exists in the framework
   skill file (`.claude/skills/<framework>.md`) — the validator's XF01 rule
   rejects pyramids referencing unknown anchors.

## License note

The cluster content is part of the Community edition (AGPL-3.0). The
verbatim normative text from ISO standards is **not** bundled — only IDs,
objectives in our own words, and cross-mappings. Tenants who hold a valid
ISO/AFNOR license can unlock verbatim retrieval via the API.
