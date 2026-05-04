# ADR 001 — Foundation: positioning, audience, scope

- **Status**: Accepted
- **Date**: 2026-05-04
- **Deciders**: solo founder
- **Supersedes**: `process-pyramid/docs/adr/001-foundation-stack.md`,
  `process-pyramid/docs/adr/002-cross-framework-strategy.md`,
  `aegis-platform/CLAUDE.md` (Phase 3 GRC ambition)

## Context

Two prior experiments accumulated unimplemented ambition:

- `process-pyramid` advertised a Neo4j + SHACL + LLM-as-judge moat that was, in
  reality, a 1038-line Pydantic linter. Frontend was an editorial landing
  without a working dashboard.
- `aegis-platform` built a credible SOC backend (pipeline, detection, alerts in
  Go) but its Phase 3 GRC features were 0% implemented — the
  `agents/compliance` directory contained 26 lines of stub.

Neither was sellable as a product. Together, they are two halves of one product
that was never assembled.

The market analysis (CISO Assistant AGPL-3.0 with 3.6k stars and 100+ frameworks,
Eramba, OpenGRC, Vanta/Drata, Egerie, Styra DAS) showed:

- Pure cloud-SaaS GRC (Vanta family) is saturated and excludes EU regulated
  customers who refuse US-cloud.
- Pure policy-as-code (Styra, Permit.io, Cerbos) ignores the human governance
  cascade — it speaks to SRE, not RSSI.
- Open-source GRC (CISO Assistant, Eramba) is mature on the policy/control side
  but **none combines** pyramid coherence + multi-target policy-as-code + LLM
  choice + air-gapped sovereignty.

That intersection is empty. It is also where the founder's expertise (cybersec
audit, ANSSI / EBIOS / ISO 27001 in France) maximally compounds.

## Decision

### Positioning

> **Egide is a sovereign, open-core GRC platform that converts the human
> chain of governance — directive, policy, procedure, process, KPI — into a
> verifiable, executable cascade.**
>
> We refuse the trade-off the market has accepted between governance
> documentation tools (Vanta, Egerie) and runtime enforcement engines
> (Styra, OPA). Egide unifies both.

### Primary buyer

RSSI / DSI of EU mid-sized organizations (200–2000 employees) under
NIS2 / ISO 27001 / DORA / HDS pressure, who:

1. Have a hybrid infrastructure (cloud + on-prem Proxmox / VMware + Ansible).
2. Refuse to send governance data to US-cloud SaaS for legal or strategic reasons.
3. Need both documentation-grade artifacts (audit-ready) AND runtime enforcement.

Secondary buyer: managed-service partners (cabinets, MSSP) who resell.

### Anti-personas

- Pure SOC operator (use `aegis-platform`).
- Cloud-native scale-up that wants Vanta-light (use Vanta).
- Solo developer needing OPA tutorials (use Styra Academy).

### Scope (what Egide IS)

- Pyramid generator (N0 frameworks → N1 directive → N2 policy → N3 procedure →
  N4 BPMN → N5 KPI → N6 evidence → optional N7 policy-as-code).
- Multi-target policy compiler (Rego, Kyverno, Ansible, CIS, AWS Config, Falco).
- Multi-LLM router with degraded mode (no AI required).
- Air-gappable deployment (Enterprise).
- 10+ EU regulatory packs as first-class citizens.

### Scope (what Egide IS NOT)

- A SOC (no Sigma rules, no kill-chain, no SOAR — those stay in `aegis-platform`).
- A pure policy-as-code tool (no Styra-level Rego authoring IDE).
- A SaaS-only product (every Enterprise install can be air-gapped on-prem).
- An ITSM ticketing tool.

### Open-core model

- Community edition under **AGPL-3.0-only** (see ADR 002).
- Professional / Enterprise editions under commercial license.
- Single codebase; edition gating at runtime via license key + feature flags.
- See `docs/editions.md` for the feature matrix.

### Time horizon

The founder is solo and patient. The plan favors correctness and depth over
speed. See `docs/roadmap.md`.

## Consequences

- All marketing, documentation, and product decisions must serve the RSSI/DSI
  EU mid-market sovereign use case. We do not chase US enterprises or
  cloud-native startups.
- The `process-pyramid` and `aegis-platform` repositories are frozen as archive.
  No new commits land there. Useful code is migrated into Egide per
  `docs/migration.md`.
- The CLAUDE.md ambition (Neo4j + SHACL + RAG + multi-agent orchestration)
  remains valid but is **honestly reflected** as a multi-quarter target,
  not as MVP claim.
- We accept three languages (TypeScript + Go + Python) as a permanent cost,
  isolated per service domain (see ADR 003).
