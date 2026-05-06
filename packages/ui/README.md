# @egide/ui

Egide front-end primitives, signature components, and design tokens.

## What's here

- `src/styles/tokens.css` — design system tokens as CSS variables (cf.
  [ADR 017](../../docs/adr/017-frontend-identity.md) +
  [docs/design-system.md](../../docs/design-system.md)).
- `src/styles/base.css` — reset, element defaults, focus styles.
- `src/components/` — signature components (to be implemented).

## Status

Scaffold. Tokens shipped. Signature components land progressively from
M1 sprint S1 as the web shell takes shape.

## Usage

In `apps/web` and the landing:

```ts
// Once, at the app root
import "@egide/ui/styles/base.css";
```

Then use CSS variables anywhere:

```css
.my-component {
  color: var(--egide-color-text-primary);
  background: var(--egide-color-surface);
  border: var(--egide-border-width) solid var(--egide-color-border);
  border-radius: var(--egide-radius);
  padding: var(--egide-space-4);
}
```

## Discipline

- **Never hard-code** colors, fonts, radii, or shadows. Use tokens.
- **No box-shadow** elevation. Use border or background shift.
- **Maximum radius**: 8px. Default 6px.
- **Density**: 32px row default (Linear-grade), not 48px+ (Vanta-grade).
- **No decorative animation**. Motion budget: 200ms max, ease-out.

See [`docs/adr/017-frontend-identity.md`](../../docs/adr/017-frontend-identity.md)
for the full anti-patterns list.

## Signature components (planned)

10 components encoding Egide's metier visually (cf. design-system.md):

1. `<AnchorChip>`
2. `<CascadeNode>`
3. `<EvidenceChain>`
4. `<ApprovalTrail>`
5. `<ImpactDiff>`
6. `<FrameworkMatrix>`
7. `<TraceBreadcrumb>`
8. `<CompiledArtifact>`
9. `<TerminalReplay>`
10. `<RegoSyntax>`
