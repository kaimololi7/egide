---
name: shacl-validation
description: SHACL (Shapes Constraint Language) reference for the coherence layer. Loaded by `coherence-validator` and when authoring/debugging SHACL rules. SHACL is the W3C standard for RDF graph constraints — our 50+ coherence rules are encoded in SHACL.
---

# SHACL — Operational guidance

SHACL = W3C Shapes Constraint Language. Validates RDF data against schemas (shapes). Our coherence layer (Neo4j → RDF → pyshacl) uses SHACL for structural and numerical rules. Semantic-textual rules use LLM-as-judge in addition.

## Why SHACL (vs alternatives)

| Option | Why we picked SHACL |
|---|---|
| OWL DL reasoning | Powerful but slow + open-world assumption fights us |
| ShEx | Less mature ecosystem in Python |
| **SHACL** ✓ | W3C standard, pyshacl mature, closed-world (what we want), human-readable |
| Custom validator | Reinvents wheel, no standard tooling |

## Shape types

### NodeShape
Constraints on a target node.
```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix pp: <https://process-pyramid.io/ontology#> .

pp:PolicyShape a sh:NodeShape ;
    sh:targetClass pp:Policy ;
    sh:property [
        sh:path pp:hasOwner ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:class pp:Person ;
        sh:message "A Policy must have exactly one Owner (Accountable)." ;
    ] ;
    sh:property [
        sh:path pp:linkedToControl ;
        sh:minCount 1 ;
        sh:message "A Policy must link to at least one normative control (S01)." ;
    ] .
```

### PropertyShape
Constraints on a specific property.

### Severity levels
- `sh:Violation` (default) — error → mutation blocked
- `sh:Warning` — proceed but flag
- `sh:Info` — observation

Mapped to our `ValidationReport.errors` / `.warnings` fields.

## Common constraint components

| Component | Use |
|---|---|
| `sh:minCount`, `sh:maxCount` | Cardinality (e.g., 1 Accountable) |
| `sh:datatype` | Type (`xsd:integer`, `xsd:dateTime`, `xsd:string`) |
| `sh:class` | Target class (e.g., must point to `pp:Person`) |
| `sh:nodeKind` | IRI / Literal / BlankNode |
| `sh:in` | Enum (e.g., status ∈ {draft, review, published}) |
| `sh:pattern` | Regex (e.g., `^P-[0-9]+$`) |
| `sh:minLength`, `sh:maxLength` | String length |
| `sh:minInclusive`, `sh:maxInclusive` | Numeric range |
| `sh:lessThanOrEquals` | Cross-property numerical (KPI threshold ≤ Policy SLA) |
| `sh:hasValue` | Specific value required |
| `sh:not`, `sh:and`, `sh:or` | Logical composition |
| `sh:sparql` | Full SPARQL constraint (escape hatch) |

## Property paths

Path expressions traverse the RDF graph:
- Direct: `pp:hasOwner`
- Inverse: `^pp:owns`
- Sequence: `pp:hasParent / pp:hasOwner` (parent's owner)
- Alternate: `pp:hasOwner | pp:hasDelegate`
- ZeroOrMore, OneOrMore: `pp:hasParent*`, `pp:hasParent+`

Used heavily for cross-level rules (e.g., walk Policy → Procedure → BPMN → KPI).

## Mapping our coherence rules to SHACL

### Example: rule S01 (Policy must link to ≥1 control)
```turtle
pp:PolicyShape sh:property [
    sh:path pp:implementsControl ;
    sh:minCount 1 ;
    sh:severity sh:Violation ;
    sh:message "Rule S01: Policy must implement at least one normative control." ;
] .
```

### Example: rule C01 (Policy SLA == Procedure SLA)
SHACL alone struggles with this — a numerical comparison across nodes. Use SPARQL constraint:

```turtle
pp:SLACoherenceShape a sh:NodeShape ;
    sh:targetClass pp:Procedure ;
    sh:sparql [
        sh:select """
            SELECT $this ?policySLA ?procSLA
            WHERE {
                $this pp:hasParentPolicy ?policy ;
                      pp:hasSLA ?procSLA .
                ?policy pp:hasSLA ?policySLA .
                FILTER (?procSLA != ?policySLA)
            }
        """ ;
        sh:message "Rule C01: Procedure SLA must equal parent Policy SLA (got {?procSLA} vs {?policySLA})." ;
    ] .
```

### Example: rule S08 (BPMN must have exactly 1 startEvent)
```turtle
pp:BPMNShape sh:property [
    sh:path pp:hasStartEvent ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Rule S08: BPMN process must have exactly one start event." ;
] .
```

## Performance

pyshacl benchmarks (on our typical pyramid: 1 Policy + 3 Procedures + 5 BPMN + 10 KPIs ≈ 200 RDF triples):
- 50 SHACL rules: ~50ms
- With SPARQL constraints (10 rules): ~120ms
- Acceptable for synchronous validation on every mutation

For larger pyramids (>1000 triples), use incremental validation:
```python
pyshacl.validate(
    data_graph=graph,
    shacl_graph=rules,
    inference="rdfs",
    abort_on_first=False,
    advanced=True,
    js=False,  # disable JS constraints
)
```

## Authoring conventions

1. **One file per concern**: `shacl-policy.ttl`, `shacl-procedure.ttl`, `shacl-bpmn.ttl`, `shacl-cross-level.ttl`
2. **Each rule has unique ID** in `sh:message` prefix (e.g., "Rule S01:")
3. **Severity matches our taxonomy**: sh:Violation = blocking, sh:Warning = warn, sh:Info = info
4. **Test every rule** with positive + ≥2 negative + 1 edge case (`tests/shacl/`)
5. **No silent passes**: if a rule cannot fire (e.g., missing data), log warning rather than silently OK

## Validation entry point

```python
from rdflib import Graph
import pyshacl

def validate_pyramid(data_graph: Graph, framework: str = "iso27001-2022") -> tuple[bool, str]:
    shacl = Graph()
    shacl.parse("packages/graph/shapes/cross-level.ttl", format="turtle")
    shacl.parse(f"ontologies/{framework}/shacl-rules.ttl", format="turtle")
    conforms, results_graph, results_text = pyshacl.validate(
        data_graph=data_graph,
        shacl_graph=shacl,
        inference="rdfs",
        advanced=True,
        debug=False,
    )
    return conforms, results_text
```

## Reference paths

- `packages/graph/shapes/` — all SHACL files
- `packages/graph/validate.py` — validation entry
- `tests/shacl/` — rule-level test fixtures

## Don'ts

- Don't write SPARQL constraints when standard SHACL components suffice (slower).
- Don't skip the `sh:message` field — error reports become unreadable.
- Don't put SHACL rules in production without unit tests.
- Don't use SHACL `sh:js` constraints — security risk + portability.
