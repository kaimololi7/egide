# ADR 006 — Graph persistence: PostgreSQL recursive CTE + JSONB

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder
- **Supersedes**: N/A (was an open question after ADR 003)

## Context

The pyramid (directive → policy → procedure → BPMN → KPI → evidence) is a
typed graph. The validator must traverse it for cross-level coherence rules
(e.g., C01 "Procedure SLA == parent Policy SLA"). The compiler walks the
graph to extract Intents and source traces.

Four persistence options were considered:

| Option | Pros | Cons |
|---|---|---|
| **Neo4j Community** | Cypher mature, NeoSemantics SHACL adapter | GPLv3 + 2 GB RAM mini → unfit for Proxmox VM bundle (Enterprise air-gapped 8 GB target) |
| **Apache AGE** (PG extension Cypher) | Cypher on Postgres, no extra infra | PG 16 max, AGE community small, ecosystem narrow |
| **PostgreSQL recursive CTE + JSONB** | Already deployed; zero new infra; well-known SQL; tested | More verbose than Cypher for deep traversals; no SHACL native |
| **TerminusDB** | RDF + SHACL native, FOSS | Niche, tooling immature, locks the stack into RDF-everywhere |

The pyramid of a typical PME/ETI fits in **<500 nodes**: 1 directive,
5–20 policies, 20–100 procedures, 50–200 BPMN nodes, 50–300 KPIs.
Traversal queries are bounded depth (max 6 levels). PG recursive CTE
handles this trivially in <10ms.

## Decision

### Primary store

The pyramid graph is persisted in **PostgreSQL** using the existing
Drizzle schema (`packages/db/src/schema.ts`). The graph is stored in two
complementary forms:

1. **Typed tables** (source of truth for mutation and validation):
   - `pyramid_nodes (id, pyramid_id, kind, payload jsonb, version_id)`
   - `pyramid_edges (id, pyramid_id, from_node_id, to_node_id, edge_type, attrs jsonb)`
   - `kind` enum: `directive | policy | procedure | bpmn_element | kpi | evidence | intent`
   - `edge_type` enum: `derives_from | implements | measures | covers | references | inherits`

2. **JSONB snapshot** (denormalized read model):
   - Stored in `pyramid_versions.graph_snapshot`, rebuilt on each version commit.
   - Used for UI display, exports, content-hashing, and external consumers
     (auditor view, OSCAL exporter, compiler input).

### Traversal pattern

Cross-level rules use **recursive CTE**:

```sql
WITH RECURSIVE descendants AS (
  SELECT n.id, n.kind, n.payload, 0 AS depth
  FROM pyramid_nodes n
  WHERE n.id = $1 AND n.pyramid_id = $2
  UNION ALL
  SELECT n.id, n.kind, n.payload, d.depth + 1
  FROM pyramid_edges e
  JOIN pyramid_nodes n ON n.id = e.to_node_id
  JOIN descendants d ON d.id = e.from_node_id
  WHERE d.depth < 6 AND e.pyramid_id = $2
)
SELECT * FROM descendants;
```

The validator (Go) calls these queries via `pgx`. Cross-rule SQL is held
in `services/validator/internal/queries/*.sql` (Go `embed.FS`). Each rule
is a Go function calling one or more queries plus comparison logic.

### Optional graph DB (Pro+ deferred)

If a customer demonstrates real need for ad-hoc Cypher exploration (e.g.,
"show every procedure across our 50 pyramids that mentions GDPR"),
**Apache AGE** can be enabled as a Pro+ feature — same PG instance, AGE
extension installed, JSONB graph snapshots replicated as AGE nodes via a
nightly sync. Not in MVP scope. No customer commitment.

### Why no graph DB native at MVP

- **Single new infra dependency rejected**. Neo4j adds ops complexity for
  ~zero gain at <1000 nodes. Air-gapped Proxmox VM would balloon.
- **AGE not stable enough**. PG 17 support pending, smaller community.
- **JSONB + CTE is sufficient** for the validator's 25 rules and the
  compiler's source_trace walks. Validated by porting the 5 hardest Python
  rules from `process-pyramid` as a spike.

## Consequences

- Validator (Go) ports the 25 rules using SQL CTE queries. No Python
  graph traversal carried over.
- ADR 003 must be updated: SHACL is **post-MVP**. The semantic equivalent
  is implemented as Go validators reading typed tables.
- `pyramid_versions.graph_snapshot` (JSONB) is the canonical export
  format for hashing and external consumers.
- If we later add Neo4j or AGE for analytical features, the JSONB snapshot
  is the import source — no data migration needed.
- Add Drizzle migrations for `pyramid_nodes` and `pyramid_edges` before
  M1 sprint S1.

## Open questions

- Should we add a materialized view for cross-pyramid analytics ("all
  policies citing iso27001:A.8.32 across all tenants")? Defer to J7.
- Index strategy: btree on `(pyramid_id, from_node_id)` for descendant
  walks; GIN on `payload` for JSONB queries. To benchmark with 5K nodes.
