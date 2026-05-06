---
name: dmn-decision-model
description: DMN 1.3 (Decision Model and Notation) reference — used when a procedure has complex decision tables (e.g., change category classification, risk scoring). Loaded as needed; not all pyramids require DMN.
---

# DMN 1.3 — Operational guidance

OMG DMN (Decision Model and Notation) 1.3 complements BPMN by modeling **decision logic** as tables and FEEL expressions. We use DMN sparingly — only when a decision has ≥3 inputs OR ≥5 outcomes (otherwise an `exclusiveGateway` in BPMN suffices).

## When to use DMN vs gateway

| Use case | Tool |
|---|---|
| Binary decision (yes/no) | BPMN exclusiveGateway |
| 3-5 outcomes on 1 input | BPMN exclusiveGateway with multiple flows |
| Decision based on ≥3 input variables | DMN decision table |
| Multi-criteria classification (RFC type, incident severity) | DMN |
| Score computation with rules | DMN with FEEL |

## Decision table elements

```
┌──────────┬──────────┬──────────┬────────────┐
│ Input 1  │ Input 2  │ Input 3  │ Output     │
│ (impact) │ (urgency)│ (system) │ (priority) │
├──────────┼──────────┼──────────┼────────────┤
│ HIGH     │ HIGH     │ -        │ P1         │
│ HIGH     │ MEDIUM   │ critical │ P1         │
│ HIGH     │ MEDIUM   │ standard │ P2         │
│ MEDIUM   │ -        │ -        │ P3         │
│ LOW      │ -        │ -        │ P4         │
└──────────┴──────────┴──────────┴────────────┘
```

Hit policy options:
- **Unique** — exactly 1 row matches (most common, safest)
- **First** — first match wins (when ordering is meaningful)
- **Priority** — output ordered, highest matching wins
- **Collect** — multiple matches, aggregated (sum, count, list)

Default for our generation: **Unique**. If LLM generates an `Any` or `RuleOrder` table, validation rejects it (too risky for non-expert maintenance).

## FEEL (Friendly Enough Expression Language)

DMN uses FEEL for cell expressions. Examples:
- Numeric: `> 1000`, `[100..500]`, `not(0)`
- String: `"high"`, `"high","critical"` (membership)
- Boolean: `true`, `false`
- Date: `date("2026-04-30")`, `> date("2026-01-01")`

Avoid complex FEEL — keep cells declarative. If logic needs more, escalate to a service task with code.

## Generation patterns

### When `procedure-generator` produces ≥3-input decision

```yaml
procedure:
  decision_points:
    - id: "DP-001"
      type: "dmn"  # vs "gateway" for simple cases
      inputs:
        - name: "impact"
          domain: ["high", "medium", "low"]
        - name: "urgency"
          domain: ["high", "medium", "low"]
        - name: "system_criticality"
          domain: ["critical", "standard", "non-critical"]
      output:
        name: "priority"
        domain: ["P1", "P2", "P3", "P4"]
```

`dmn-generator` (when invoked) translates this to a DMN 1.3 file referenced by the BPMN's businessRuleTask.

## XML structure (minimal)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             id="Definitions_1" name="ChangePriority"
             namespace="https://process-pyramid.io/dmn">
  <decision id="Decision_Priority" name="Change priority decision">
    <decisionTable id="DecisionTable_1" hitPolicy="UNIQUE">
      <input id="In_Impact" label="Impact">
        <inputExpression typeRef="string">
          <text>impact</text>
        </inputExpression>
      </input>
      <input id="In_Urgency" label="Urgency">
        <inputExpression typeRef="string">
          <text>urgency</text>
        </inputExpression>
      </input>
      <output id="Out_Priority" label="Priority" name="priority" typeRef="string"/>
      <rule id="Rule_1">
        <inputEntry id="UnaryTests_1"><text>"high"</text></inputEntry>
        <inputEntry id="UnaryTests_2"><text>"high"</text></inputEntry>
        <outputEntry id="LiteralExpression_1"><text>"P1"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
```

## Coherence with BPMN

A DMN decision is invoked from a `businessRuleTask` in BPMN. Since we don't allow `businessRuleTask` in the reduced palette (cf. `bpmn-2-0.md`), we use a `serviceTask` with a `bpmnio:dmn` extension attribute.

## When NOT to use

- Don't model trivial 2-outcome decisions in DMN — XOR gateway is clearer.
- Don't put DMN where the rules are unstable (changing weekly) — externalize to a config service instead.
- Don't generate FEEL with `if/else if/else` chains — that's a code smell, restructure as table.

## Reference paths

- `packages/bpmn/dmn-parser.ts` — DMN 1.3 parsing (dmn-moddle)
- `packages/bpmn/dmn-validator.ts`
- `ontologies/shared/dmn-shacl.ttl` — SHACL constraints for DMN

## Validation rules

- Hit policy must be Unique, First, or Priority (not Collect/Any/RuleOrder/Output for MVP)
- Maximum 20 rules per table (UX limit)
- Maximum 5 inputs per table
- All cells must be valid FEEL expressions (validated via `dmn-moddle`)
