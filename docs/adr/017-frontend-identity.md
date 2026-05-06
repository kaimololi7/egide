# ADR 017 — Front-end identity and design system

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder
- **Operationalizes**: ADR 013 (MVP persona)
- **References**: `docs/design-system.md`, `docs/landing-blueprint.md`,
  `docs/dashboard-blueprint.md`

## Context

A GRC product looks like 1 000 other GRC products: dashboards crowded
with KPI cards, hero sections with three feature columns, "AI-powered"
slogans, aurora gradients, illustration packs. This dilutes credibility
with the technical persona (ADR 013) — sysadmin / DevOps / SRE /
operational RSSI of PME-ETI — who reads Hacker News, lives in a
terminal, and is allergic to glossy SaaS UX.

If Egide's surface looks like a templated SaaS, the persona will not
trust the substance, regardless of the architectural quality
documented in ADRs 003-016.

The front must therefore **encode the same values as the architecture**:
sovereignty (sober, EU-flavored, no US-cloud dependencies in tooling),
verifiability (code visible, traces clickable), executability (CLI
parity, terminal-as-hero), governance (cascade visible, signatures
explicit). Not abstract beauty — functional identity.

## Decision

### Visual reference set (study these, not Vanta)

The cultural references for Egide's front are **devtool-grade** and
**EU-sovereign-flavored**, not enterprise SaaS:

- **Linear** — density, K-bar, dark mode mature, micro-typography
- **Tailscale** — sober ambient lighting, code-as-hero, doc-quality copy
- **Fly.io** — editorial tech voice, hand-drawn infra schemas
- **Sourcegraph** — code exploration, breadcrumbs, syntax-as-content
- **Plain** — devtool helpdesk, no glossy
- **Resend** — code samples occupy 50% of hero
- **Modal** — running terminal as hero
- **Cursor** — embedded interactive preview
- **Scaleway / OVH** — French sovereign reference, sober without cheesy
- **OPA Gatekeeper docs** — governance/code visual coherence

**Anti-references** (do not look at, do not copy): Vanta, Drata,
Egerie, Tenacy, ServiceNow, any landing with aurora/mesh gradient/orbs,
any ThemeForest template.

### Design tokens

#### Colors (dark mode default, invertible)

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#0B0E0D` | App background (ink, not pure black) |
| `--color-surface` | `#131816` | Cards, panels |
| `--color-surface-raised` | `#1B2220` | Modals, dropdowns |
| `--color-border` | `#2A332F` | All borders (1px hairline) |
| `--color-text-primary` | `#E8EAE6` | Main text |
| `--color-text-secondary` | `#95A19C` | Helpers, labels |
| `--color-text-muted` | `#5C6863` | Hints, timestamps |
| `--color-accent` | `#5FA889` | UNIQUE accent — sovereign green |
| `--color-success` | `#5FA889` | Same as accent for coherence |
| `--color-warning` | `#D4A65A` | Stale, attention |
| `--color-danger` | `#B85450` | Errors, blocked |
| `--color-info` | `#6B8FAB` | Neutral info |

**Framework anchor colors** (used in `<AnchorChip>`):

| Framework | Hex |
|---|---|
| ISO 27001 | `#4A7C59` |
| ISO 9001 | `#6B8E7F` |
| NIS2 | `#2D5F8B` |
| DORA | `#8B5A8B` |
| CIS | `#8B6F2D` |
| HDS | `#6B5A8B` |

The accent is **sovereign green** (`#5FA889`). Rationale: subtle EU
signal without falling into "audit firm bronze/burgundy" cliché. ONE
accent only — discipline forces the design to do work via layout and
type, not color.

#### Typography

| Family | Weight | Use |
|---|---|---|
| **Inter Tight** | 400 / 500 / 600 | UI body, headings, paragraphs |
| **JetBrains Mono** | 400 / 500 | Code, refs, anchors, terminal |
| **Iosevka Etoile** | 400 / 500 | Display / brand (landing hero, marquees) |

Why these:

- **Inter Tight** instead of Inter classic: tighter tracking, more
  density, signals "we care about how the type works".
- **JetBrains Mono** instead of generic mono: bonus signal "tech",
  excellent ligatures, free.
- **Iosevka Etoile** for display: less common than Cal Sans / Geist /
  Söhne — gives Egide an immediately recognizable brand without paid
  fonts.

Forbidden: Geist (Vercel-coded), Cal Sans (indie-hacker-coded), generic
Times/Helvetica.

#### Geometry and density

| Token | Value |
|---|---|
| Border radius | 6px everywhere — no exceptions (NOT 8/12/16 of shadcn defaults) |
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px |
| Row height (dense lists) | 32px (Linear-grade), NOT 48px+ (Vanta-grade) |
| Border width | 1px hairline (always); no double borders |
| Elevation | NO box-shadow ; separation by border or background shift only |

#### Motion

| Property | Value |
|---|---|
| Default duration | 150ms |
| Max duration | 200ms (anything longer feels sluggish for the persona) |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo) |
| Allowed | hover transitions, accordion expand/collapse, modal in/out, syntax highlight reveal |
| Forbidden | infinite animations (rotate, float, pulse, glow), parallax, mouse-following effects, decorative entrance animations |

### Signature components (the visual moat)

Ten components unique to Egide, encoding the metier visually. They are
the front's identity, not "button" or "card". Specified in
`docs/design-system.md` and implemented in `packages/ui/`:

1. `<AnchorChip ref="iso27001-2022:A.8.13" />` — normative anchor as a tag
2. `<CascadeNode kind="directive|policy|procedure|...">` — typed pyramid node
3. `<EvidenceChain hashes={[...]} />` — visual hash chain
4. `<ApprovalTrail signatures={[...]} />` — Ed25519 signature timeline
5. `<ImpactDiff before={...} after={...} />` — before/after action diff
6. `<FrameworkMatrix coverage={...} />` — framework × control heatmap
7. `<TraceBreadcrumb path={[...]} />` — directive→...→artifact path
8. `<CompiledArtifact code={...} sources={...} />` — code with source_trace overlay
9. `<TerminalReplay commands={[...]} />` — replayed terminal session (landing only)
10. `<RegoSyntax code={...} annotations={...} />` — Shiki-rendered Rego with TAI annotations

Discipline: every signature component respects tokens. No box-shadow,
no decorative animation, no color outside the palette.

### Anti-patterns — visual

- ❌ Aurora background, mesh gradient, orb glow, beams, sparkles, meteors
- ❌ Border radius > 8px anywhere
- ❌ Box-shadow elevation (use border or background shift)
- ❌ Decorative animation (rotate, float, infinite glow, parallax)
- ❌ Icons in colored circles
- ❌ Three-column feature card grids without narrative
- ❌ Cartoon illustrations (unDraw, Storyset, Blush)
- ❌ AI-generated images in production (ever)
- ❌ Lottie / decorative animation
- ❌ Stock shadcn components (button/card/badge as-is)

### Anti-patterns — copywriting (anti-AI-slop linguistic)

Forbidden words and phrases in marketing copy:

- `supercharge`, `unlock`, `seamless`, `intelligent`, `AI-powered`,
  `10x your X`, `transform your X`, `the future of X`, `revolutionize`,
  `next-generation`, `cutting-edge`, `enterprise-grade`, `world-class`,
  `best-in-class`, `industry-leading`
- Superlatives without proof: "the most", "the best", "the only"
- "Trusted by 1000+ companies" without those companies
- Fake client logos / "powered by" marquees
- Vague AI claims without measurable backing

Preferred voice:

- Short factual sentences
- Code samples > adjectives
- Exact numbers ("compiles to 5 production-grade Rego policies")
- Honest scope ("Rego today, Ansible at M6, more later")
- ADR / RFC links as credibility ("see ADR 014 for the OWASP mapping")

### Tooling — sovereign, FOSS-first

| Category | Tool | Verdict |
|---|---|---|
| Primitives | Radix UI | ✅ accessibility base |
| Component starter | shadcn/ui (forked, custom tokens) | ✅ start, then own |
| Theme generator | TweakCN | ✅ to bootstrap shadcn theme with our tokens |
| Tables | TanStack Table | ✅ for dense lists |
| Charts | visx (preferred) or Recharts | ✅ for matrix and timelines |
| Code highlight | Shiki | ✅ best Rego/Ansible highlighting |
| Code walkthroughs | CodeHike | ✅ for landing "show me the code" |
| Icons | Lucide | ✅ NOT Heroicons (Vercel-default) |
| Diagrams (internal) | Mermaid | ✅ ADR/docs only |
| Diagrams (exploration) | Excalidraw | ✅ brainstorm |
| Diagrams (production) | Hand-coded SVG from Figma | ✅ obligatoire |
| Animation interactive | Rive | ⚠️ optional, only if SVG/CSS insufficient |
| Demo embeds | HTML/CSS/JS hand-coded | ✅ obligatoire |
| Fonts | Inter Tight + JetBrains Mono + Iosevka Etoile | ✅ all free, self-hosted |
| Hosting (landing) | Scaleway Edge or OVH Web | ✅ sovereign coherence |

Forbidden:

- ❌ LangChain / Aceternity UI / Magic UI / Skiper UI / Origin UI as final blocks
- ❌ unDraw / Storyset / Lordicon / LottieFiles
- ❌ Guideflow / Navattic / Walnut / HowdyGo (US SaaS, sovereign-incompatible)
- ❌ Spline / Three.js (decorative 3D)
- ❌ Vercel as production hosting for landing (US — use Scaleway/OVH)
- ❌ Geist font, Cal Sans, Cabinet Grotesk

### Implementation plan

1. **`docs/design-system.md`** — tokens + signature components specs
   (companion to this ADR).
2. **`docs/landing-blueprint.md`** — section-by-section landing structure
   with copy and components used.
3. **`docs/dashboard-blueprint.md`** — page-by-page dashboard structure
   with navigation, density, empty states.
4. **Figma file** (offline) — tokens + 10 signature components + landing
   sections + dashboard pages.
5. **`apps/web/src/styles/tokens.css`** — tokens as CSS variables (M1
   sprint S1, before any component).
6. **`packages/ui/`** — forked shadcn primitives + 10 signature
   components.

## Consequences

- The front becomes a brand asset, not a generic UI shell.
- Solo dev cost: ~2-3 days to fork shadcn + define tokens, then ~1-2
  days per signature component (×10 = 2-3 weeks initial). Pays back
  every time we ship a feature using them.
- Landing page becomes a credibility lever: looks like a serious
  open-source devtool, not an SaaS startup.
- Recruiting / community signal: anyone landing on the repo or website
  immediately reads "this team knows what they're doing".
- Updating any front primitive requires respecting tokens — can't
  silently use a 12px radius or a box-shadow.

## Open questions

- Light mode? Default dark, invertible. Light mode polishing deferred to
  M5+ when the dashboard stabilizes.
- Internationalization: French primary in user-facing strings (ADR 013) ;
  English secondary. To define the i18n stack at M3 (probably
  next-intl).
- Landing in 2 languages from day 1, or French-only at MVP? Defer call
  to M5 when first landing ships ; bilingual is +1 week.
