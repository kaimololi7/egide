# Egide — Claude Code skills

Skills are lazy-loaded references for Claude Code sessions working in this
repository. Each skill file is loaded only when CLAUDE.md `@-references` it
or when the agent explicitly looks it up.

## Skill index

### Frameworks (regulatory and standard references)

- `iso27001-2022.md` — ISO/IEC 27001:2022 (93 Annex A controls, ISMS clauses 4-10)
- `iso9001-2026.md` — ISO 9001:2026 FDIS (process approach, climate change context)
- `nis2-directive.md` — Directive (UE) 2022/2555 (Article 21, Article 23 timelines)
- `dora-regulation.md` — Règlement (UE) 2022/2554 (5 chapters, CTPP, RTS/ITS)
- `itil4-framework.md` — ITIL 4 (34 management practices, SVS, value chain)
- `hds-health-data.md` — Hébergeur Données de Santé (FR certification)

### Standards and notations

- `bpmn-2-0.md` — Reduced palette, structural rules, ID conventions
- `dmn-decision-model.md` — When to use over BPMN gateway, hit policies
- `oscal-structure.md` — NIST OSCAL layers, mapping pyramid → SSP
- `shacl-validation.md` — Shapes, property paths, performance budget

### Policy-as-code (compiler targets)

- `opa-rego.md` — Rego style, package conventions, OPA testing
- `kyverno.md` — ClusterPolicy generation, mutate vs validate
- `ansible.md` — Audit + remediate split, inventory contract, Molecule tests
- `cis-benchmarks.md` — SCAP / bash / Inspec output formats, license caveats

### Egide internals

- `pyramid-coherence-rules.md` — 25+ rules, severities, fix patterns
- `audit-readiness.md` — Per-framework checklists (ISO, ITIL, NIS2, DORA)
- `llm-router-providers.md` — Provider matrix, routing recommendations, degraded mode
- `proxmox-api.md` — Proxmox VE connector, endpoints, TLS, sovereignty

## When to add a new skill

A new skill is justified when:
- A new framework, target, or major external system needs codification.
- An existing skill grows beyond ~250 lines (split it).
- A topic recurs in 3+ Claude sessions without a stable reference.

A skill is NOT the place for:
- Implementation details (those live in source comments).
- Decisions (those live in ADRs).
- Roadmap (that lives in `docs/roadmap.md`).
- Per-customer tenant config (that lives in the database).

## Provenance

11 skills migrated from `~/dev/process-pyramid/.claude/skills/` on 2026-05-04
unchanged.

5 new skills written specifically for Egide:
- `hds-health-data.md`
- `opa-rego.md`
- `kyverno.md`
- `ansible.md`
- `proxmox-api.md`
- `cis-benchmarks.md`
- `llm-router-providers.md`

(7 new actually — the count grows as we add policy targets.)

## Updating skills

When ground truth changes (new framework version, deprecated provider, etc.),
update the relevant skill in the same PR as the code change. Skills out of
sync with the code are worse than no skills.
