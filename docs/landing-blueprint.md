# Egide — Landing page blueprint

> Section-by-section structure with copy, visual components, and
> anti-patterns. Implements ADR 013 (persona) + ADR 017 (identity) using
> components from `docs/design-system.md`.

## Audience and goal

**Reader profile** (cf. ADR 013):

- Sysadmin / DevOps / SRE / security engineer "forced" into GRC
- Operational RSSI of PME-ETI 50-500
- Lives in terminal + git + YAML ; reads Hacker News
- Allergic to glossy SaaS UX
- 30-second attention budget on first scroll

**Goal**: in 30 seconds of scroll, the reader must understand:

1. **What it compiles** (Rego today, more later — explicit, no hand-waving)
2. **Where it runs** (self-hosted, sovereign, air-gappable)
3. **What it costs** (open-source AGPL ; transparent commercial pricing)
4. **Why it's not another Vanta** (cascade visible, code samples, ADR-grade docs)

If the reader does not get these four answers, the landing failed.

## Page structure (7 sections)

```
[ S1 — Hero ]
[ S2 — What it actually does ]
[ S3 — Show me the code ]
[ S4 — Sovereignty without compromise ]
[ S5 — How it integrates ]
[ S6 — How we build it ]      ← the section nobody else does
[ S7 — Pricing transparent ]
[ Footer ]
```

Total length target: ~5 viewport heights. No more.

---

## S1 — Hero (above the fold)

### Layout

50/50 split. Left = text + CTAs. Right = animated SVG cascade.

### Left column — copy

**Headline** (Iosevka Etoile display, 48px, tracking-tight):

> From a signed directive
> to a Rego rule blocking a non-compliant Pod.

**Subhead** (Inter Tight 18px, --color-text-secondary):

> Open-source GRC that compiles your governance into runnable policies.
> Sovereign EU. Air-gappable. Bring your own LLM, or none at all.

**CTAs** (two buttons, side by side):

- Primary: `Start with Docker Compose →`
- Secondary: `View on GitHub →`

NO third CTA. NO "Book a demo".

**Below CTAs** — small badges row (NOT logos, just text):

> AGPL-3.0  ·  16 ADRs published  ·  Built by an iTrust security consultant

### Right column — animated cascade SVG

Hand-coded SVG, 8-second loop. Tokens-only colors. No external library.

Sequence:

1. **t=0s** — node "ISO 27001 A.8.13" appears (`<AnchorChip>` style)
2. **t=1s** — arrow descends to `Policy: Backup required (P-014)`
3. **t=2s** — arrow descends to `Procedure: PR-014`
4. **t=3s** — arrow descends to `Intent: db_backup_required.json`
5. **t=4s** — `Intent` node splits into 3 parallel arrows, each
   compiling to one target: `policy.rego`, `playbook.yml`, `cis-check.sh`
6. **t=6s** — `policy.rego` border turns green (`--color-accent`),
   subscript appears: `blocked Pod prod-db-3 at 12:34:02`
7. **t=8s** — fade out, restart

**No hover effects on the SVG**. It's a passive demo, not a toy.

### Below the hero — terminal replay (one viewport down, but still on initial scroll)

A `<TerminalReplay>` component spans full width:

```
$ egide pyramid generate --frameworks iso27001,nis2 --input ./docs
✓ extracted 14 documents (Docling)
✓ classified 87 chunks against ISO 27001 + NIS2
✓ generated 12 policies, 28 procedures, 14 BPMN, 31 KPIs
✓ validated 25 coherence rules (all pass)
✓ wrote pyramide.json (sha256:1a2b3c…)

$ egide compile rego --intent intent_db_backup_required
✓ compiled to bundles/db_backup.tar.gz
✓ ran 6 fixtures via opa test (all pass)
✓ signed bundle (Ed25519)

$ kubectl apply -f bundles/db_backup.tar.gz
opa-bundle/db-backup created
```

JetBrains Mono. Caret blinks. Pace ~80ms/character. Loop.

### Anti-patterns S1

- ❌ Aurora background, glow, particles
- ❌ "AI-powered" or "intelligent" anywhere
- ❌ Stock photo of a CISO in a suit
- ❌ Carousel auto-rotating screenshots
- ❌ "Trusted by Acme, Globex, Initech"
- ❌ Cookie banner pop-up before reading anything

---

## S2 — What it actually does

### Layout

3 dense cards in a row (max-width 1100px). Border 1px hairline, no
shadow. Title in Inter Tight 22px, body in Inter Tight 14px.

### Card 1 — Ingest

**Icon** (Lucide `inbox`, 24px, --color-accent):

**Title**: Ingest

**Body**:

> Drop your existing PDFs, Word, and Markdown.
> Egide extracts and classifies against ISO 27001, NIS2, DORA, CIS, HDS
> in 10 minutes.
> Works **without an LLM** in template-only mode.

**Footer**: `→ How it works` (link to `/docs/journeys/j1`)

### Card 2 — Compile

**Icon** (Lucide `code-2`):

**Title**: Compile

**Body**:

> Every policy emits a runnable Rego bundle, signed and tested against
> fixtures.
> Ansible at M6. Kyverno, CIS, AWS Config, Falco follow.

**Footer**: `→ See the IR spec` (link to `/docs/specs/intent-ir`)

### Card 3 — Approve

**Icon** (Lucide `signature` or `check-circle-2`):

**Title**: Approve

**Body**:

> Every production-touching action requires Ed25519 human signature.
> Audit trail by construction. OSCAL exports in Pro+.

**Footer**: `→ Threat model` (link to `/docs/threat-models/approval-workflow`)

### Anti-patterns S2

- ❌ "AI-powered"/`intelligent`/`seamless` anywhere
- ❌ Generic icons in colored circles
- ❌ Animation on hover beyond border-color shift

---

## S3 — Show me the code

### Layout

Section spans full viewport height. CodeHike-style: scroll-driven,
left = explanation that progresses, right = `<CompiledArtifact>` that
highlights different sections as user scrolls.

### Default state

Right column shows a real Rego artifact:

```rego
package egide.policies.db.backup
# Source: policy_data_protection_v3 / iso27001-2022:A.8.13
# Compiled by Egide v0.5.2 at 2026-05-04T12:00:00Z

deny[msg] {
    input.resource.kind == "PostgresCluster"
    input.resource.metadata.labels["egide.io/criticality"] == "high"
    not input.resource.spec.backup.enabled
    msg := sprintf(
        "Production database %v must have backup enabled (ISO 27001 A.8.13, NIS2 Art.21.2.c)",
        [input.resource.metadata.name],
    )
}
```

Left column initial copy:

> ### Every Rego rule traces back.
>
> Egide compiles a normalized Intent into Rego. Every line carries a
> source comment pointing back to the pyramid artifact and the
> normative anchor.
>
> Scroll to see how.

### Scroll interactions

As user scrolls:

1. Highlight `# Source:` comment → left shows
   `<TraceBreadcrumb path={[Directive, Policy P-014, Procedure PR-014, Intent, Artifact]} />`
2. Highlight `deny[msg]` block → left explains the TAI Intent →
   Rego compilation pattern, links to ADR 005
3. Highlight `iso27001-2022:A.8.13` in the comment → left shows the
   `<AnchorChip>` with the actual ontology objective + cross-mappings
4. Final state → left shows: `→ See ADR 005 for the full compilation pipeline`

### Anti-patterns S3

- ❌ Fake / cleaned-up code that wouldn't actually compile
- ❌ Code without source comments
- ❌ Adding "Copy" button (we want them to read, not paste)

---

## S4 — Sovereignty without compromise

### Layout

2x2 grid (4 quadrants), no separators except 1px border. Each quadrant
~280px tall. Headlines in Inter Tight 18px medium.

### Quadrant 1 — Bring your own LLM

> Anthropic, Mistral La Plateforme, Scaleway AI, OVH AI, OpenAI-compat,
> or local Ollama / vLLM.
> Per-task routing. Budget caps. Every call audited with tenant,
> provider, model, tokens, cost.

Footer: `Read ADR 004 →`

### Quadrant 2 — Or no AI at all

> Template-only mode generates a usable pyramid from 10 normative
> clusters without a single LLM call.
> Air-gapped customers run zero LLM. Demo without an API key.

Footer: `Read ADR 004 §degraded mode →`

### Quadrant 3 — Where you choose to run it

> Docker Compose for evaluation. Helm chart for K8s. Proxmox VM image
> for air-gapped Enterprise (bundled Mistral 7B).
> No mandatory cloud dependency.

Footer: `Deployment options →`

### Quadrant 4 — What you choose to send out

> `privacy_mode: strict` blocks all cloud LLM calls.
> PII scrubber runs pre-prompt for anything cloud-bound.
> Every external call recorded with full payload metadata.

Footer: `Read ADR 014 §LLM02 →`

### Anti-patterns S4

- ❌ Marketing absolutes ("complete sovereignty", "total privacy")
- ❌ Country flags as decoration
- ❌ Maps with arrows showing "data stays in the EU"

---

## S5 — How it integrates

### Layout

Full-width section. Two parts:

**Top — integration row** (16 mini logos, no glow):

`git`, `Kubernetes`, `Ansible`, `OPA`, `Kyverno (M10)`, `Proxmox`,
`CIS Benchmarks`, `OSCAL`, `NATS`, `S3 / MinIO`, `PostgreSQL`,
`ClickHouse`, `GitHub Actions`, `Terraform`, `Helm`, `cosign`

Each rendered as a Lucide icon or simplified SVG mark + label below.
No colored backgrounds. Greyscale. Hover = `--color-accent` tint.

**Bottom — workflow code sample**:

```yaml
# .github/workflows/grc.yml
name: GRC pipeline
on: [push]
jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: egide/action-compile@v1
        with:
          intent: intent_db_backup_required
          targets: [rego, ansible]
      - uses: egide/action-validate@v1
      - uses: egide/action-bundle-sign@v1
        with:
          key: ${{ secrets.EGIDE_SIGNING_KEY }}
      - uses: egide/action-publish-oci@v1
        with:
          registry: ghcr.io
```

Caption below:

> Egide is a CLI first. Every action that runs in your terminal also
> runs in your CI. No vendor lock-in.

### Anti-patterns S5

- ❌ Logos in colored boxes
- ❌ "And many more..." marquee
- ❌ "Talk to sales for custom integrations"

---

## S6 — How we build it (differentiator nobody copies)

### Layout

Full-width section, dark background (`--color-surface`), light text.
Title large (Iosevka Etoile 36px):

> ### How we build Egide

### Body — 4 pillars in a column (left-aligned, narrative voice)

**1. Open-source by default.**

> AGPL-3.0 core. DCO sign-off, no CLA. Self-host without a license
> ping. Commercial license only for Pro/Enterprise features —
> documented in [ADR 002](/docs/adr/002).

**2. ADR-driven.**

> 17 ADRs publicly tracked. Every architectural decision justified and
> reviewable.
> [Browse all 17 →](/docs/adr/)

**3. Security mapped.**

> OWASP Web Top 10 (2021) and OWASP LLM Top 10 (2025) explicitly
> mapped to controls in [ADR 014](/docs/adr/014).
> Threat models per non-trivial feature in
> [`docs/threat-models/`](/docs/threat-models).
> Full SBOM (CycloneDX) per release. cosign-signed images.

**4. Sovereign tooling.**

> No US-cloud SaaS in our build chain.
> NATS over Kafka. PostgreSQL + pgvector over Elasticsearch.
> PydanticAI over LangChain.
> Self-hosted Langfuse for LLM observability ([ADR 011](/docs/adr/011)).

### Anti-patterns S6

- ❌ "Built by AI for AI" / "the future of compliance"
- ❌ Founder photo (not the persona's interest)
- ❌ Vague "we care about quality"

---

## S7 — Pricing transparent

### Layout

3 columns side by side. No "Most popular" badge. No "Contact us" on Pro.

### Column 1 — Community

> **0 €**
> AGPL-3.0
>
> - 1 tenant
> - All 6 framework packs
> - Rego compiler (Ansible at M6)
> - BYOK or local Ollama
> - Template-only mode (no AI required)
> - Community Discord support
>
> [Install with Docker Compose →]

### Column 2 — Professional

> **8 000 € / year**
> Commercial license, self-hosted or Egide Cloud
>
> - Up to 5 tenants
> - Advanced compiler targets (Kyverno, CIS, AWS Config — by M10)
> - Continuous compliance + auditor view
> - Cloud collectors (Proxmox, AWS, Azure, Scaleway, OVH)
> - LLM observability (Langfuse)
> - Email support 48h
>
> [Buy with Stripe →]

### Column 3 — Enterprise

> **30 000 — 100 000 € / year**
> Commercial license, includes air-gapped deployment
>
> - Unlimited tenants
> - Air-gapped Proxmox VM bundle (Mistral 7B included)
> - SSO / SAML / OIDC / SCIM (Authentik)
> - White-label MSSP mode
> - Signed OSCAL exports + hash chain
> - 24/7 SLA + named CSM
> - Strategic→executable cascade with directive signature workflow (J6)
>
> [Talk to us →]

### Footer below pricing

> All editions share one codebase. AGPL-3.0 source code on GitHub.
> [Compare in detail →](/docs/editions)

### Anti-patterns S7

- ❌ Hidden Pro pricing
- ❌ "Custom" Enterprise pricing without a range
- ❌ Annual vs monthly pricing toggles (we sell annual contracts)
- ❌ "Free trial" overlay

---

## Footer

Minimal. 4 columns:

| Product | Documentation | Open source | Company |
|---|---|---|---|
| Editions | Architecture | GitHub repo | About |
| Pricing | ADRs | Roadmap | Contact |
| Changelog | Security | Issues | Legal / RGPD |
| Roadmap | API | Discussions | LinkedIn |

Bottom row: `© 2026 Egide. Built with sober love in EU.` + AGPL-3.0
badge + version `v0.X.Y`.

---

## Layout rules — global

- Max content width: 1100px (text), 1280px (with side visuals)
- Vertical rhythm: 96px between major sections
- All borders: 1px hairline `--color-border`
- All radius: 6px max
- No box-shadow anywhere
- Sticky header: hide on scroll-down, reveal on scroll-up
- Header content: `Egide` wordmark (Iosevka Etoile) + 4 nav links
  (`Product`, `Docs`, `GitHub`, `Pricing`) + 1 CTA (`Start →`)

## Performance budget

- LCP ≤ 1.5s on 4G
- CLS = 0
- Total JS ≤ 100 KB gzipped
- Hero SVG inlined (no network roundtrip)
- Self-hosted fonts (subset to Latin extended)
- No third-party scripts (no Google Analytics, no Hotjar, no Intercom)
  — sovereign coherence with the pitch

Use Plausible or self-hosted Umami for analytics. EU-hosted.

## Stack — final

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Styling | Tailwind v4 + custom tokens (cf. design-system.md) |
| Primitives | Radix UI |
| Code highlight | Shiki (custom Egide theme matching tokens) |
| Code walkthroughs | CodeHike for S3 |
| Icons | Lucide |
| Hosting | Scaleway Edge or OVH Web (NOT Vercel) |
| Analytics | Plausible (EU) or self-hosted Umami |
| Fonts | Inter Tight + JetBrains Mono + Iosevka Etoile (self-hosted) |

## Implementation order (when M5 lands)

1. Tokens CSS file (`apps/web/src/styles/tokens.css`).
2. Layout components (header, footer, container).
3. Signature components used: `<AnchorChip>`, `<TraceBreadcrumb>`,
   `<CompiledArtifact>`, `<TerminalReplay>` (and the SVG hero animation).
4. S1 hero with animated SVG cascade.
5. S2-S7 sections.
6. CodeHike integration for S3.
7. Performance pass (LCP, bundle size).
8. Accessibility pass (WCAG 2.2 AA).

## Reference

- ADR 013 — MVP persona
- ADR 017 — Front-end identity
- `docs/design-system.md` — tokens + signature components
- `docs/dashboard-blueprint.md` — companion (in-app structure)
