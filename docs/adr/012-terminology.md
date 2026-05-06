# ADR 012 — Terminology: agents, AI workers, collectors

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder

## Context

The word "agent" appears throughout the codebase and documentation with
**three distinct meanings** that are easy to confuse:

1. **Edge agent** — Go binary deployed on customer machines for posture
   collection.
2. **AI worker** — Python process that runs an LLM agent loop (PydanticAI).
3. **Connector / collector** — adapter that pulls data from a third-party
   API (Proxmox, AWS, Ansible inventory).

In skills and docs we have references like "the compliance agent",
"agents/common", "edge/agent", "Proxmox connector". The same word
"agent" is overloaded; without convention, prompts and code drift.

## Decision

### Three reserved words

| Term | Domain | Code location | Examples |
|---|---|---|---|
| **agent** | System binary that runs on a customer host | `edge/agent/` | `edge/agent` for posture collection |
| **AI worker** | Python process running an LLM-driven loop | `agents/*` | `agents/compliance` (the multi-step PydanticAI agent), `agents/orchestrator` |
| **collector** | Adapter pulling data from an external API | `services/pipeline/connectors/` | `proxmox-collector`, `ansible-inventory-collector`, `aws-collector` |

The directory `agents/` keeps its name to preserve git history and
conventions, but its contents are referred to as **AI workers** in all
prose, ADRs, marketing, and UI labels.

### Skills update

The skills directory still uses "agent" because that's how the LLM
ecosystem speaks (PydanticAI Agent, Anthropic Agent SDK). When a skill
mentions "agent", read it as **the LLM agent loop running inside an AI
worker**.

Some skills currently reference 10 implicit "agents" (`ontology-modeler`,
`policy-generator`, …). After ADR 011 (super-agent strategy), these are
**tools** within the single `agents/compliance` AI worker. Skills are
edited to call them tools.

### User-facing UI strings

| Where | What | French label |
|---|---|---|
| Settings → AI engine | Configuration LLM Router | "Moteur IA" |
| Edge management | Edge agents installed | "Agents Egide installés" |
| Integrations | Cloud / on-prem connectors | "Connecteurs" |
| Job dashboard | Async work queue | "File de tâches" |

Never "AI worker" in the UI — it's an internal term. UI says "Egide
analyse vos documents" or "Notre moteur IA…", but never "le worker IA".

### Marketing copy (technical persona)

The persona (technical, sysadmin/DevOps/RSSI op) reads docs and READMEs.
Use precise terms:

- "edge agent" for the binary to install on hosts
- "connecteurs / connectors" for cloud and on-prem APIs
- "moteur IA / AI engine" for the LLM-backed components (avoid "agent IA"
  which is overloaded with the previous two)

When in doubt, prefer **functional naming** ("le module de classification
fait X") over **role naming** ("l'agent classifieur fait X").

## Consequences

- Update CLAUDE.md to introduce these terms.
- Update `docs/architecture.md` component descriptions.
- Update skill files to disambiguate "agent" usage where confusing.
- New README messaging respects this vocabulary.
- Code identifiers in `agents/*` may use `worker` or `processor` suffix
  internally where it clarifies (e.g., `ComplianceWorker` class) but
  package names stay `agents.compliance` for ergonomics.

## Open questions

- Do we eventually rename `agents/` → `ai_workers/`? Costs more than it
  buys at this stage. Defer.
