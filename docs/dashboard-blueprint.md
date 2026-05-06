# Egide — Dashboard blueprint

> Page-by-page in-app structure with navigation, layout, density, and
> empty/loaded states. Implements ADR 013 (persona) + ADR 015
> (architecture / bounded contexts) + ADR 017 (identity) using
> components from `docs/design-system.md`.

## Audience and goal

**Reader profile** (cf. ADR 013):

- Sysadmin / DevOps / SRE / op RSSI
- Comfortable with `kubectl`, `git log`, `tmux`, K9s, Linear
- Reads dense, scans fast, dislikes wizards and modals
- Wants to know *what needs their attention* and *what they can act on*

**Goal**: in 2 seconds after login, the user knows what is broken,
pending, or stale. In 1 click, they can act.

## Design references

- **Linear** ([linear.app](https://linear.app)) — density, K-bar,
  sidebar IA, dark mode, sober motion
- **Sourcegraph** — code/dependency exploration, breadcrumbs
- **K9s** — terminal density translated to UI
- **GitHub** — PR/issue/diff workflow, commit-trail
- **Cursor / VS Code** — command palette as primary navigation

NOT Vanta, NOT ServiceNow, NOT Drata.

## Global layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  egide  ▾ acme-corp           [⌘K]                  ●NATS ●PG ●LLM │  ← topbar (48px)
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                          │
│ Overview │                                                          │
│ Govern.  │                                                          │
│ Frmwks   │              <main content area>                         │
│ Compile  │                                                          │
│ Approve  │                                                          │
│ Audit    │                                                          │
│ Settings │                                                          │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
                                                                       ↑
                                                    bottom-right toast
                                                       (NATS event live)
```

- Sidebar width: 200px collapsed → 56px (icons only) by default on
  small screens.
- Topbar fixed, height 48px.
- Main content: max-width 1400px, padding 24px.

### Sidebar entries

7 entries max, in this order (cf. ADR 013):

1. **Overview** (`home`) — what needs attention
2. **Governance** (`folder-tree`) — pyramid tree
3. **Frameworks** (`grid-2x2`) — coverage matrix
4. **Compile** (`code-2`) — bundles + tests
5. **Approve** (`signature`) — approval timelines
6. **Audit** (`shield-check`) — evidence chain + OSCAL exports
7. **Settings** (`settings`) — tenant config, users, AI engine

Each entry has a **count badge** (Lucide-style, JetBrains Mono 11px)
showing the number of pending items. e.g., `Approve  3`,
`Compile  2 stale`.

### Topbar

- **Tenant switcher** (left) — only visible if user has multi-tenant
  access (Pro+).
- **K-bar** (`⌘K` / `Ctrl+K`) — opens a global command palette
  (Linear-style). Indexes: pyramids, intents, frameworks, anchors,
  commands. Keyboard-first.
- **Status dots** (right) — three colored dots for `NATS`, `PG`,
  `LLM router`. Click → opens `Settings → Health`.
- **User menu** (far right) — avatar, account, sign out.

### Bottom-right toast area

Live events from NATS (e.g., "intent_db_backup_required compiled
successfully"). Auto-dismiss 5s. Stack max 3.

### Keyboard shortcuts (Linear-grade)

| Shortcut | Action |
|---|---|
| `⌘K` | Open command palette |
| `g o` | Go to Overview |
| `g g` | Go to Governance |
| `g f` | Go to Frameworks |
| `g c` | Go to Compile |
| `g a` | Go to Approve |
| `g d` | Go to Audit |
| `g s` | Go to Settings |
| `?` | Open keyboard shortcut reference |
| `Esc` | Close modal / drawer |
| `j` / `k` | Navigate down / up in lists |
| `Enter` | Open selected item |
| `c` | Compose / create (context-dependent) |

Documented in a `?` modal accessible from anywhere.

---

## Page 1 — Overview ("what needs your attention")

### Purpose

Replace the "executive dashboard" pattern with **Linear's "My Issues"**:
a prioritized list of items that need the user's attention now.

### Layout

Two columns: 2/3 main + 1/3 side.

### Main column — attention list

Title: `What needs your attention` (Inter Tight 22px medium).

Below, a vertical list of cards. Each card:

```
┌──────────────────────────────────────────────────────────┐
│ ⚠  3 approvals waiting your signature                   │
│    Production-touching changes pending Ed25519 sign-off  │
│    [j9-ansible-prod-db-restart, …]                       │
│                                            View all  →   │
└──────────────────────────────────────────────────────────┘
```

Card variants:

- **Approvals pending** (`signature` icon, warning color) → click =
  Approve page filtered
- **Stale compiled artifacts** (`code-2` icon, warning color) →
  click = Compile page with "recompile all stale" CTA
- **Drift detected** (`activity` icon, danger color) → click =
  Audit page filtered to drift events
- **Failed validation** (`alert-triangle` icon, danger color) →
  click = Governance page on the failing artifact
- **License expiring soon** (`key` icon, info color, only if <30d) →
  Settings page

If empty (nothing pending), show a single muted card:

> All clear. Last sync: 12:34. Next stale check: in 11 min.

### Side column — coverage glance

Title: `Coverage` (Inter Tight 14px medium, --color-text-secondary).

Below, three small `<FrameworkMatrix>` thumbnails (compact variant) for
the top 3 frameworks active for this tenant:

```
ISO 27001-2022    ████████░░░░  72%  → click for details
NIS2              ████████████  100%
DORA              ████░░░░░░░░  28%
```

Below that, `Last 24h activity`:

```
12:34  ✓ compiled intent_db_backup_required
11:02  ✓ mistral-large drafted policy P-019
10:55  ⚠ 2 stale artifacts detected
09:12  ✓ approval signed: j6-directive-2026-q1
```

Each line is a clickable link to its detail.

### Empty state (new tenant)

Single full-width card centered:

> ### Welcome.
> No pyramid yet. Drop your existing docs to get started, or generate
> a starter from the 10 normative clusters.
>
> [Drop documents]   [Generate from templates]

---

## Page 2 — Governance (the cascade browser)

### Purpose

Browse the pyramid graph: directive → policies → procedures → BPMN →
KPIs → evidence. The page that makes the metier visible.

### Layout

3 columns:

```
┌─────────────┬───────────────────────────┬──────────────────┐
│ Tree        │ Selected node detail      │ Source trace     │
│ (240px)     │ (flex-grow)               │ (320px)          │
│             │                           │                  │
│ Directive   │ Policy P-014              │ ↑ Provenance     │
│ ├ Policy    │ Backup required           │   Directive...   │
│ │ ├ Proc.   │ Status: published         │   Cluster...     │
│ │ └ Proc.   │ Owner: rssi@acme.fr       │   ISO27 A.8.13   │
│ └ Policy    │ Last update: 2 days ago   │                  │
│             │ ─── tabs ───              │ ↓ Descendants    │
│             │ Definition / Procedures /  │   Procedure...   │
│             │ KPIs / Compiled / History  │   Intent...      │
│             │                           │   Rego artifact  │
└─────────────┴───────────────────────────┴──────────────────┘
```

### Tree (left)

- Lazy-loaded
- Each node is a `<CascadeNode>` (compact)
- Filter input at top (`Filter pyramid…`)
- Right-click = context menu (open in new pane, copy ID, view source)

### Detail (center)

Node title in Inter Tight 22px. Tabs below:

- **Definition** — markdown content, RACI, numerical commitments
- **Procedures** (if Policy) — list of derived procedures
- **KPIs** — list of `<CascadeNode kind="kpi">` with current actuals
- **Compiled** — list of `<CompiledArtifact>` with status
- **History** — version timeline with diffs (using same component as
  GitHub commits view)

Action bar (top-right):
- `Edit` (opens drawer, not modal)
- `Validate` (runs validator inline)
- `Compile to…` (dropdown of available targets)
- `Export` (dropdown: OSCAL JSON, Markdown, PDF)

### Source trace (right)

Title: `Provenance` then `Descendants`. Both columns of
`<TraceBreadcrumb>` (vertical compact variant). Each item clickable to
navigate the tree.

### Empty state

If no node selected:

> Select a node from the tree, or use `⌘K` to search.

---

## Page 3 — Frameworks (coverage)

### Purpose

Show how each in-scope framework is covered by the pyramid.

### Layout

For each active framework, a section:

```
ISO 27001:2022                                  72% covered  ▾ collapse
─────────────────────────────────────────────────────────────────
SoA: signed 2026-04-12 by rssi@acme.fr        [Re-sign] [Export]

[ <FrameworkMatrix /> rendered as 16-col × N-row grid ]
                                               hover = control title
                                               click = drill-down

Audit-readiness: 4/5 checks pass
A_ISO27_01 ✓ All in-scope controls covered
A_ISO27_02 ✓ SoA present and signed (< 12 months)
A_ISO27_03 ✓ Evidence trail per control
A_ISO27_04 ⚠ Risk register has 2 unlinked controls
A_ISO27_05 ✓ PDCA improvement plan dated < 12 months
```

Sections collapsible. Default = first one expanded, others collapsed.

### Drill-down

Clicking a control in the matrix opens a side drawer:

- Control title + objective + cross-mappings
- List of covering pyramid artifacts (each is a clickable
  `<TraceBreadcrumb>`)
- "Generate missing artifact" CTA if status is `gap`

### Empty state (no framework active)

> No framework activated yet. Activate a framework in
> [Settings → Frameworks].

---

## Page 4 — Compile (bundles and tests)

### Purpose

List of compiled artifacts, their status, and operations.

### Layout

Single dense table (TanStack Table). Columns:

| Intent | Target | Status | Last test | Compiler version | Actions |
|---|---|---|---|---|---|
| intent_db_backup_required | rego | ✓ fresh | 6/6 pass | v0.5.2 | View · Re-test · Sign |
| intent_mfa_required | rego | ⚠ stale | 4/5 pass | v0.5.1 | Re-compile |
| intent_log_retention | ansible | ✗ failed | 3/8 pass | v0.5.2 | View errors |

Row height 32px. Filter bar at top. Bulk actions (re-compile selected,
re-test all).

### Modal "View"

Opens a `<CompiledArtifact>` in a side drawer:

- Code with annotations
- Source trace
- Test report (per-fixture pass/fail)
- Hash, signature, generated_at
- "Download bundle (.tar.gz)" button

### Empty state

> No intents compiled yet. Compile from the Governance view, or via CLI:
>
> `egide compile rego --intent <id>`

---

## Page 5 — Approve (timeline of signatures)

### Purpose

GitHub-PR-style list of approval requests. Each = one card.

### Layout

Vertical list of cards, sortable / filterable.

```
┌────────────────────────────────────────────────────────────────┐
│ 🟡 Pending  ·  j9-ansible-prod-db-restart                      │
│    Apply playbook restart-prod-db.yml on prod-db-3              │
│    Requested by ops@acme.fr · 2h ago · Expires in 22h           │
│                                                                 │
│    Required: 2 signatures (1/2 collected)                       │
│    ✓ rssi@acme.fr signed approve "Verified diff in CI #4521"    │
│    ⏳ Awaiting cto@acme.fr                                      │
│                                                                 │
│    [View diff]   [Approve]   [Reject]                          │
└────────────────────────────────────────────────────────────────┘
```

Detail view (click) opens a side drawer with:

- Full `<ApprovalTrail>`
- Full `<ImpactDiff>` (before/after state)
- Full payload (collapsed by default)
- Action buttons

### Filters

- Status: pending / approved / rejected / expired
- Kind: ansible_apply / directive_signature / production_mutation /
  rule_exception / artifact_publication
- Assignee: me / others / unassigned
- Period: last 24h / last week / last month / all

### Keyboard

- `c` = compose new approval request (admin only)
- `Enter` = open detail
- `a` = approve selected (with comment prompt)
- `r` = reject selected (with comment prompt)

### Empty state

> No approvals pending.

---

## Page 6 — Audit (evidence chain)

### Purpose

Sentry-events-style timeline of all audit events with hash chain
visualization.

### Layout

Top: filter bar (period, actor, kind, severity).

Middle: timeline of events. Each event = a row:

```
12:34:02  ✓ artifact.compile  rego  intent_db_backup_required  v0.5.2
                                                  sha256:1a2b…
12:32:15  ✓ approval.signed   rssi@acme.fr   j9-prod-db-restart
                                                  sig:9f8e…
…
```

Right side: a vertical `<EvidenceChain>` showing the hash chain
visually. Hover any row → highlights its position in the chain. Broken
chain = red line + warning.

Top-right: `Export OSCAL` button (Pro+, signed in Enterprise).

### Drill-down

Click a row → side drawer with full event payload, hash, prev_hash,
signature (if any), actor metadata.

### Empty state

> No audit events in the selected period.

---

## Page 7 — Settings

### Purpose

Tenant configuration. Single page with sections (one-pager scroll).

### Sections

1. **General** — tenant name, slug, locale, timezone
2. **Editions and license** — current edition, license key status,
   expiration
3. **AI engine** — provider selection per task type, BYOK keys
   (encrypted), budget cap, privacy mode toggle, embed model selection
4. **Frameworks** — toggle on/off the 6 framework packs
5. **Users and roles** — user list, RBAC, invite link, MFA enforcement
6. **Auth** — Better-Auth config (Community/Pro), Authentik SAML/OIDC
   (Enterprise)
7. **Integrations / collectors** (Pro+) — Proxmox, Ansible inventory,
   AWS, Azure, Scaleway, OVH, K8s, ServiceNow, Jira SM, etc.
8. **Notifications** — Slack / Teams / email destinations per event class
9. **Health** — NATS / PG / LLM router status, disk usage, last backup
10. **Security** — IP allow-list (Enterprise), session timeout, audit
    log retention

### Layout

Left navigation (anchor links to sections). Right side = content. Each
setting is inline-edited (Linear-style), no "save" button per field —
debounced auto-save with toast confirmation.

---

## Component reuse — what comes from where

Every page uses tokens from `docs/design-system.md`. Signature
components used:

| Component | Used in |
|---|---|
| `<AnchorChip>` | Governance detail, Frameworks drill-down, Compile annotations |
| `<CascadeNode>` | Governance tree, Frameworks drill-down |
| `<EvidenceChain>` | Audit page |
| `<ApprovalTrail>` | Approve page |
| `<ImpactDiff>` | Approve detail drawer |
| `<FrameworkMatrix>` | Frameworks page, Overview side column |
| `<TraceBreadcrumb>` | Governance source trace, Compile annotations |
| `<CompiledArtifact>` | Compile detail drawer |
| `<TerminalReplay>` | Landing only (NOT in dashboard) |
| `<RegoSyntax>` | Compile detail drawer (subset of CompiledArtifact) |

## Density rules

- Default row height: 32px
- Compact mode toggle in user prefs: 28px
- Comfortable mode: 36px (max)
- Cards: padding 16px, no shadow, border 1px
- Modals → prefer side drawers (Linear-style); modals only for
  confirmation dialogs

## Empty state principles

- Always actionable (CTA to next step, or CLI command)
- Never decorative illustrations (no unDraw)
- Short ; one sentence + 1-2 buttons max

## Loading state principles

- Skeleton with token-based borders (no shimmer animation)
- Optimistic UI for mutations (commit local state, rollback on error)
- Streaming for long-running operations (J1) — progress timeline via
  NATS subjects + SSE

## Error state principles

- Use the error taxonomy from `docs/architecture-principles.md`
- Show: code, message, retry button if `retryable: true`,
  `documentation_url` link
- Never raw stack trace
- Toast for transient errors (auto-dismiss 8s) ; inline panel for
  blocking errors

## Accessibility

- WCAG 2.2 AA target
- All interactive elements keyboard-reachable
- Focus visible (ring `--color-accent`, 2px offset)
- Color contrast >= 4.5:1 for body, >= 3:1 for large text
- ARIA landmarks on each page
- axe-core in CI

## Responsive

- Desktop-first (the persona is on a 27" or 14" laptop, rarely
  mobile)
- Mobile (<768px): sidebar collapses, K-bar primary navigation
- Tables: horizontal scroll on mobile, sticky first column
- No mobile-specific marketing — Egide is a desktop tool

## Implementation order

1. Tokens CSS file
2. Layout shell (sidebar + topbar + content area + K-bar primitive)
3. Page 1 (Overview) with Approve count badge from NATS
4. Page 2 (Governance) — depends on validator + DB
5. Page 4 (Compile) — depends on compiler service
6. Page 5 (Approve) — depends on approval workflow primitives (ADR 010)
7. Page 6 (Audit) — depends on evidence chain implementation
8. Page 3 (Frameworks) — needs ontology + coverage computation
9. Page 7 (Settings) — incremental as features land

## Reference

- ADR 013 — MVP persona
- ADR 015 — Architectural principles + bounded contexts
- ADR 017 — Front-end identity
- `docs/design-system.md` — tokens + signature components
- `docs/landing-blueprint.md` — companion (marketing surface)
