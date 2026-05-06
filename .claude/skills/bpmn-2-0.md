---
name: bpmn-2-0
description: BPMN 2.0 modeling reference — reduced palette (8-12 elements) for non-expert users, structural rules, and the conventions used by `bpmn-generator`. Loaded for any BPMN-related work.
---

# BPMN 2.0 — Operational guidance

OMG BPMN 2.0 (Business Process Model and Notation) is the de facto standard for executable process diagrams. The **full specification has 100+ elements**; we use a deliberately reduced palette (8-12) targeted at non-BPM-experts.

## Reduced palette (only these elements)

### Events
| Element | Symbol | Use case |
|---|---|---|
| `startEvent` | ○ | Process trigger (request received, time elapsed) |
| `endEvent` | ◉ | Process outcome (success, rejection, timeout) |
| `intermediateTimerEvent` | ◔ | SLA deadline within process |
| `intermediateMessageCatchEvent` | ✉ | Wait for external signal |

### Activities
| Element | Symbol | Use case |
|---|---|---|
| `task` | ▭ | Generic work step (default if unsure) |
| `userTask` | ▭👤 | Human-performed step (most common in ITIL/QMS) |
| `serviceTask` | ▭⚙ | Automated step (API call, system action) |
| `callActivity` | ▭▭ | Sub-process call (links to another BPMN) |

### Gateways
| Element | Symbol | Use case |
|---|---|---|
| `exclusiveGateway` | ◇ | XOR — one path taken based on condition |
| `parallelGateway` | ◇+ | AND — all paths taken simultaneously |

### Connectors
- `sequenceFlow` (→) — step ordering within a process
- `messageFlow` (- - ▷) — communication between processes / pools

### Containers
- `process` — root container
- `lane` — actor swimlane within a process
- `laneSet` — collection of lanes
- `participant` — pool, only if multi-org collaboration

## Forbidden in MVP

These are valid BPMN but excluded for non-expert UX:
- complexGateway · eventBasedGateway
- manualTask · sendTask · scriptTask · businessRuleTask
- compensationEvent · escalationEvent · cancelEvent · linkEvent
- transactional sub-process · ad-hoc sub-process
- multi-instance markers · loop markers
- data objects (`dataObject`, `dataStore`) — substitute with task names

If a process truly requires these, escalate to `process-architect` to either restructure with the reduced palette or open a feature request to expand palette (with UX cost analysis).

## Structural rules (enforced by SHACL S08-S10)

1. **Exactly 1 start event per process** (S08)
2. **At least 1 end event per process** (S09)
3. **No orphan nodes** — every node reachable from start, every node reaches an end (S10)
4. **No infinite loops without exit condition** (S10)
5. **Lane assignment mandatory** for every flowNode (every task/event/gateway must be in a lane)
6. **Sequence flow direction unambiguous** — no crossing flows when possible (layout concern)

## XML structure (minimal valid example)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  targetNamespace="https://process-pyramid.io/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Demandeur" name="Demandeur">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="RFC créée"/>
    <bpmn:userTask id="Task_1" name="Soumettre la demande"/>
    <bpmn:endEvent id="EndEvent_1" name="RFC enregistrée"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1"/>
  </bpmn:process>
</bpmn:definitions>
```

## ID conventions

- StartEvent_1, StartEvent_2... (1-indexed within file)
- EndEvent_1...
- Task_1... (or UserTask_1, ServiceTask_1 if want explicit type)
- Gateway_1...
- Flow_1... for sequence flows
- Lane_<RoleName> (snake_case role)
- Process_<slug>

## Conventions for `bpmn-generator`

- Element labels in user's locale (FR or EN)
- Internal IDs ALWAYS in English snake_case (no spaces, no accents)
- Diagram interchange (DI) layout calculated by post-processor (`packages/bpmn/layout.ts`) — NOT in generator output
- Default direction: left-to-right horizontal swimlanes

## Validation tools

- **lxml** (Python) — XML well-formedness
- **bpmn-validator** (Node.js, npm) — BPMN 2.0 schema + semantic checks
- **bpmn-js modeler** (browser) — interactive editing + validation
- Custom SHACL rules (`packages/bpmn/shacl-bpmn.ttl`) — our reduced-palette rules

## Coherence rules invoked

`bpmn-generator` and `coherence-validator` enforce:
- C02: every Procedure step has a corresponding BPMN node
- C03: every Procedure actor has a corresponding lane
- C04: every BPMN task or output has a KPI
- C08: every SLA from Procedure becomes a timer event with matching duration
- C09: every Procedure decision_point becomes an exclusive gateway

## Reference paths

- `packages/bpmn/parser.ts` — TS parser based on bpmn-moddle
- `packages/bpmn/layout.ts` — DAG topological + Sugiyama layout
- `packages/bpmn/validator.ts` — schema + reduced-palette rules
- `packages/bpmn/shacl-bpmn.ttl` — SHACL constraints for BPMN structures

## Don'ts

- Don't expose the full palette to users — UX failure mode #1.
- Don't generate DI layout in the LLM — use the deterministic post-processor.
- Don't mix English IDs and French labels in the same `name` attribute.
