# Egide — Design system

> Source of truth for visual tokens and signature components. Companion
> to ADR 017. Implemented in `apps/web/src/styles/tokens.css` and
> `packages/ui/`.

## Tokens

### CSS variables (final)

```css
:root {
  /* ── Color: surfaces ────────────────────────────────────── */
  --color-bg: #0B0E0D;
  --color-surface: #131816;
  --color-surface-raised: #1B2220;
  --color-border: #2A332F;
  --color-border-strong: #3A453F;

  /* ── Color: text ────────────────────────────────────────── */
  --color-text-primary: #E8EAE6;
  --color-text-secondary: #95A19C;
  --color-text-muted: #5C6863;
  --color-text-inverse: #0B0E0D;

  /* ── Color: accent (UNIQUE) ─────────────────────────────── */
  --color-accent: #5FA889;
  --color-accent-hover: #6FB89A;
  --color-accent-muted: #2C4F40;

  /* ── Color: semantic ────────────────────────────────────── */
  --color-success: #5FA889;
  --color-warning: #D4A65A;
  --color-danger: #B85450;
  --color-info: #6B8FAB;

  /* ── Color: framework anchors ───────────────────────────── */
  --color-fw-iso27001: #4A7C59;
  --color-fw-iso9001: #6B8E7F;
  --color-fw-nis2: #2D5F8B;
  --color-fw-dora: #8B5A8B;
  --color-fw-cis: #8B6F2D;
  --color-fw-hds: #6B5A8B;

  /* ── Typography ─────────────────────────────────────────── */
  --font-ui: "Inter Tight", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --font-display: "Iosevka Etoile", "Inter Tight", sans-serif;

  /* Type scale */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.8125rem;   /* 13px */
  --text-base: 0.875rem;  /* 14px — UI default */
  --text-md: 1rem;        /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.375rem;    /* 22px */
  --text-2xl: 1.75rem;    /* 28px */
  --text-3xl: 2.25rem;    /* 36px */
  --text-display: 3rem;   /* 48px — landing hero only */

  /* Line height */
  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Letter spacing */
  --tracking-tight: -0.01em;
  --tracking-normal: 0;
  --tracking-wide: 0.04em;

  /* ── Geometry ───────────────────────────────────────────── */
  --radius: 6px;
  --radius-sm: 4px;
  --radius-lg: 8px;       /* maximum, use sparingly */

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Density */
  --row-height: 32px;
  --row-height-compact: 28px;

  /* Borders */
  --border-width: 1px;

  /* ── Motion ─────────────────────────────────────────────── */
  --duration-fast: 100ms;
  --duration: 150ms;
  --duration-slow: 200ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Light mode (post-M5)

Inversion deferred. When implemented, override above with light surfaces
(`#FAFAF8` bg, `#FFFFFF` surface) and dark text. Accent stays
`#5FA889`. Forbidden: switching accent across modes.

## Signature components — specifications

Each component is a typed React component in `packages/ui/`. Spec below
is normative ; implementation must match props, behavior, and
constraints exactly.

### 1. `<AnchorChip>`

A normative anchor reference rendered as a tag with framework color
coding.

**Props**:
```ts
interface AnchorChipProps {
  ref: string;                  // "iso27001-2022:A.8.13"
  variant?: "default" | "compact" | "outline";
  status?: "covered" | "partial" | "gap" | "unknown";
  onClick?: () => void;         // opens drawer with anchor details
}
```

**Visual**:
- Border 1px, radius 6px, font JetBrains Mono 12px
- Background = `--color-fw-<framework>` at 12% opacity
- Border = `--color-fw-<framework>` at 40% opacity
- Text color = `--color-fw-<framework>` (full)
- Status icon prefix (compact circle): green/yellow/red/grey

**Anti-patterns**: never embed an icon other than the status circle ;
never animate ; never multi-line.

### 2. `<CascadeNode>`

A typed node in the pyramid graph (used in cascade visualizations).

**Props**:
```ts
interface CascadeNodeProps {
  kind: "directive" | "policy" | "procedure" | "bpmn" | "kpi" | "evidence" | "intent";
  title: string;
  id?: string;
  status?: "draft" | "review" | "published" | "stale";
  selected?: boolean;
  onClick?: () => void;
}
```

**Visual**:
- Each kind has a distinct icon (Lucide):
  `directive`=stamp, `policy`=scroll, `procedure`=list-checks,
  `bpmn`=git-branch, `kpi`=gauge, `evidence`=shield-check,
  `intent`=file-code
- Border 1px ; selected = accent border, accent-muted background
- Status as a small dot in top-right corner

**Anti-patterns**: never use shadow ; never animate hover beyond
border-color transition.

### 3. `<EvidenceChain>`

A visual representation of the linked-list hash chain of evidence blobs.

**Props**:
```ts
interface EvidenceChainProps {
  events: Array<{
    id: string;
    contentHash: string;
    prevHash: string | null;
    kind: string;
    timestamp: string;
    actor?: string;
  }>;
  onSelect?: (id: string) => void;
}
```

**Visual**:
- Vertical timeline ; each event is a card
- Content hash (truncated `sha256:abc1234…`) in JetBrains Mono
- Connecting line between events shows hash continuity (`prev_hash`
  matches predecessor's `content_hash`) ; broken chain = red line + danger icon

**Behavior**: clicking an event opens a drawer with the full hash and
metadata.

### 4. `<ApprovalTrail>`

Timeline of Ed25519-signed approvals on an action.

**Props**:
```ts
interface ApprovalTrailProps {
  request: {
    id: string;
    kind: string;
    status: "pending" | "approved" | "rejected" | "expired";
    requiredApprovals: number;
    expiresAt: string;
  };
  signatures: Array<{
    approver: { name: string; email: string };
    decision: "approve" | "reject";
    comment?: string;
    signedAt: string;
    signature: string;
  }>;
}
```

**Visual**:
- Header: status badge + countdown to expiry
- List of signatures with approver, decision (icon), comment, timestamp
- Each signature shows truncated `sig:` hash
- Pending slots shown as empty rows with "awaiting"

### 5. `<ImpactDiff>`

Before/after view of an action awaiting approval (e.g., Ansible playbook).

**Props**:
```ts
interface ImpactDiffProps {
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  format?: "yaml" | "json";
  scope?: string;             // "host: prod-db-3" / "namespace: prod"
}
```

**Visual**:
- Two-pane diff (Shiki diff syntax)
- Color: `--color-danger` for removals, `--color-success` for additions
- Scope label at top
- "View raw payload" toggle

### 6. `<FrameworkMatrix>`

Heatmap of framework × control coverage.

**Props**:
```ts
interface FrameworkMatrixProps {
  framework: "iso27001-2022" | "nis2" | "dora" | "iso9001-2026" | "cis" | "hds";
  controls: Array<{
    ref: string;
    status: "covered" | "partial" | "gap" | "out_of_scope";
    artifactsCount: number;
  }>;
  cols?: number;              // default 16
}
```

**Visual**:
- Grid of cells, one per control
- Cell color: success/warning/danger/muted by status
- Hover = tooltip with control title + artifact count
- Click = drill-down to filtered Governance view

### 7. `<TraceBreadcrumb>`

Provenance path from directive to artifact.

**Props**:
```ts
interface TraceBreadcrumbProps {
  path: Array<{
    kind: "directive" | "policy" | "procedure" | "intent" | "artifact";
    id: string;
    title: string;
  }>;
  compact?: boolean;
}
```

**Visual**:
- Horizontal chain of `<CascadeNode>` (compact variant) separated by
  `›` (chevron) in `--color-text-muted`
- Each item clickable → navigates to its detail page

### 8. `<CompiledArtifact>`

A compiled policy artifact (Rego/Ansible/etc.) with source_trace
annotations.

**Props**:
```ts
interface CompiledArtifactProps {
  artifact: {
    target: "rego" | "ansible" | "kyverno" | "cis" | "aws_config" | "falco";
    content: string;
    contentHash: string;
    signature?: string;
    intentRef: string;
    intentVersion: string;
    pyramidArtifact: string;
    normativeAnchors: string[];
  };
  showAnnotations?: boolean;
}
```

**Visual**:
- Header: target badge, intent ref, signed indicator (if Enterprise)
- Code area: Shiki-rendered with target-specific grammar
- Right gutter: annotations linking lines to source artifacts
  (clickable `<TraceBreadcrumb>`)
- Footer: contentHash, generated_at, compiler_version

### 9. `<TerminalReplay>`

A scripted terminal session for landing pages (NOT a real shell).

**Props**:
```ts
interface TerminalReplayProps {
  prompt?: string;            // default "$"
  steps: Array<{
    type: "input" | "output";
    text: string;
    delayMs?: number;
  }>;
  loop?: boolean;
  autoStart?: boolean;
}
```

**Visual**:
- macOS-style title bar (3 dots) but in our color palette (no
  red/yellow/green dots — use border circles)
- JetBrains Mono, --color-text-primary on --color-bg
- Input typed character-by-character with caret blink
- Output streamed line-by-line with realistic pacing
- No emoji output, no marketing copy in the script

### 10. `<RegoSyntax>`

Standalone Rego highlighter with optional inline annotations.

**Props**:
```ts
interface RegoSyntaxProps {
  code: string;
  annotations?: Array<{
    line: number;
    text: string;
    href?: string;
  }>;
  theme?: "egide-dark" | "egide-light";
}
```

**Visual**:
- Shiki rendering with custom Egide theme matching tokens
- Annotations render as small badges to the right of the line
- No copy button by default (we want the user to read, not copy)

## Component composition rules

- All signature components consume tokens via CSS variables, never
  hard-coded colors.
- All interactive components have `:focus-visible` styles using
  `--color-accent`.
- All components support `data-state` attributes (Radix convention)
  for testability.
- All text strings are externalized for i18n (next-intl, M3+).

## Implementation checklist (per component)

When implementing a signature component:

- [ ] Storybook story (or equivalent) showing all states.
- [ ] Visual regression test (Playwright screenshot).
- [ ] Accessibility audit (axe-core in CI ; WCAG 2.2 AA target).
- [ ] Type-safe props with JSDoc.
- [ ] No box-shadow ; no decorative animation ; no AI-generated assets.
- [ ] Documented in this file with example.

## Reference

- ADR 017 — Front-end identity and design system
- `docs/landing-blueprint.md` — landing structure using these components
- `docs/dashboard-blueprint.md` — dashboard structure using these components
- Figma file (offline) — visual source of truth
