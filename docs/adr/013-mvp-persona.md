# ADR 013 — MVP persona: technical staff forced into GRC + operational RSSI of PME/ETI

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder
- **Refines**: ADR 001 (broader buyer audience)

## Context

ADR 001 declared the buyer as "RSSI / DSI of EU mid-sized organizations
(200–2000 employees)". This is correct as a market segment but **too
broad to drive MVP product decisions**. Within that segment, three
sub-personae have radically different expectations:

| Sub-persona | What they want | What they buy |
|---|---|---|
| Quality manager (ISO 9001 certified) | Word-grade documents, audit-ready binders | Notion-like editor, no-code workflows |
| RSSI in suit (political role, mostly committee work) | Dashboards for COMEX, signed evidence | Vanta-grade glossy SaaS, executive summaries |
| **Technical staff forced into GRC + operational RSSI** | A GRC tool that **doesn't fight the way they already work**: CLI, YAML, git, Ansible, Rego, Linear-grade UX | Open-source-ish, sovereign, scriptable, integrates with their pipelines |

These three personae cannot be served by the same MVP without product
schizophrenia. We must pick one.

## Decision

### Primary MVP persona: technical staff forced into GRC + operational RSSI of PME/ETI

The MVP is built for, and explicitly addresses:

1. **The technical staff "forced" into GRC** — sysadmin, DevOps, SRE,
   security engineer who finds themselves wearing the GRC hat without
   asking for it. Frequent in PME 50–300 with no dedicated RSSI, and in
   ETI 200–500 with one overworked RSSI who delegates the operational
   work to whoever in IT is "good with documentation".

2. **The operational RSSI** — not the political/committee RSSI in a
   suit, but the one who actually writes policies, runs audits, fights
   with Excel matrices and wants to commit her ISO 27001 SoA to git.
   PME 50-300 and ETI 200-500.

These two share:

- Familiarity with the **command line**, git, YAML, JSON.
- Allergy to enterprise SaaS UX (Vanta-grade glossy, no-code workflow
  builders, mandatory wizards).
- Comfort with **OPA / Ansible / K8s / cloud APIs** — this is their
  daily tooling.
- Strong preference for **self-hostable, sovereign, transparent** tools
  (Linux mindset).
- Time-poor: solo or 2-person team for security AND compliance AND audit.

### What this implies for the product

| Decision | MVP impact |
|---|---|
| **CLI is first-class** | `egide` CLI ships in M1 alongside the web UI ; every action available in both ; CLI is documented as a primary interface, not a "power user" feature |
| **UX is Linear/Notion-grade for devs**, not Vanta-grade for CISO | shadcn/ui kept minimal, no animation overload, keyboard-first, dense info |
| **Frameworks ordered by cybersec relevance**: ISO 27001:2022 → NIS2 → CIS → DORA → ISO 9001 (last) | The first 4 frameworks ship; ISO 9001 deprioritized but still in pack for completeness |
| **Policy-as-Code (Rego at MVP) is a marquee feature**, not a hidden Pro+ option | Persona reads about Rego in the README and recognizes themselves immediately |
| **Template-only mode without AI is the entry door**, not a degraded mode | Persona evaluates without wanting to set up an LLM key first |
| **Ollama / local LLM is treated as first-class** | Persona runs locally before deciding ; sovereign + free |
| **Every artifact exports as YAML/JSON, every config is text** | git-friendly, diff-friendly, CI-integrable |
| **Air-gapped deployment is documented from M4** | Persona's employer often has air-gap requirements |

### Anti-personae (explicitly out of scope at MVP)

- **The non-technical quality manager** who wants a Word-shaped editor
  and a printed binder. They will be served by the M9-M12 wave.
- **The CISO in suit** focused on board-level reporting and committee
  workflow. They are a J6 (strategic-cascade Enterprise) audience, not
  MVP.
- **The cloud-native scale-up** wanting Vanta-light. Wrong product, send
  them to Vanta or CISO Assistant Cloud.
- **The pure SOC operator**. SOC stays in `aegis-platform` archive.
- **The OPA expert who wants a Rego IDE**. We are not Styra. We compile
  to Rego ; we do not author it.

### Frameworks priority (drives ontologies + skill effort)

For the MVP persona, the framework relevance is:

1. **ISO 27001:2022** — 90% of RSSI mid-market start here.
2. **NIS2** — legal pressure post-2024 transposition.
3. **CIS Controls / Benchmarks** — technical persona reads CIS daily.
4. **DORA** — niche fintech but high-value.
5. **HDS** — niche health but sovereign-aligned.
6. **ISO 9001:2026** — kept in ontology pack but not in MVP marketing.

The 10 cluster YAMLs already cover all six frameworks via cross-mapping.
Marketing emphasizes the first three.

### Marketing voice

Drop "boardroom-grade", "executive cascade", "governance maturity". Use:

- "Generate your ISO 27001 + NIS2 documentation from your existing infra
  and ship it as Rego policies in your K8s cluster — without ever sending
  data to a US cloud."
- "GRC for people who'd rather write a Helm chart than a Word document."
- "From `git push` to ISO 27001 audit-ready in one CI pipeline."

## Consequences

- **`apps/cli` becomes a first-class workspace** in `pnpm` — was implicit, now explicit.
- **README rewritten** with persona-aligned pitch (ADR backlog item).
- **Ontology priority** in `ontologies/registry.yaml` keeps current 10
  clusters but tags ISO 9001 as "secondary" for MVP.
- **`docs/editions.md` adjusted**: Community edition's Rego compiler is
  the marquee feature, not a secondary Pro+ teaser.
- **Roadmap M0-M3** reframed: every demo and tutorial is sysadmin/DevOps
  oriented (Ansible inventory, K8s admission, git workflow).
- **Pricing**: Pro 5–15K€/year is realistic for a 200-person ETI with one
  overworked RSSI. Enterprise 30–100K€ is for organizations with formal
  audit requirements (HDS, DORA, NIS2 essential entity).

## Open questions

- When do we re-broaden to quality managers and political CISOs? Likely
  M12+ once the MVP traction is proven among technical buyers.
- Should there be an "Egide for non-technical RSSI" UX skin later?
  Probably yes ; same backend, different shell. Defer.
