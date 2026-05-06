# @egide/web

Egide web app — Next.js 15 (App Router, RSC) + Tailwind v4 + `@egide/ui`
design tokens. Implements ADR 017 (front identity) and follows
`docs/landing-blueprint.md` + `docs/dashboard-blueprint.md`.

## Status

Scaffold. Loads tokens, renders a placeholder landing page using design
system colors and typography. Full landing structure (7 sections) lands
at M5+, dashboard pages at M3+.

## Run

```bash
pnpm --filter @egide/web dev
# → http://localhost:3000
```

## Layout

```
src/
├── app/
│   ├── layout.tsx           # root layout, dark mode by default
│   ├── globals.css          # token import + Tailwind v4 @theme map
│   └── page.tsx             # landing placeholder
├── components/              # signature components from @egide/ui (planned)
└── lib/
    └── trpc-client.ts       # tRPC client to apps/api (planned)
```

## Hosting

Production: **Scaleway Edge Services** or **OVH Web Hosting** (cf.
ADR 017 — sovereign coherence). NOT Vercel.

## Reference

- ADR 017 — Front-end identity and design system
- `docs/landing-blueprint.md` — section-by-section landing structure
- `docs/dashboard-blueprint.md` — dashboard pages
- `docs/design-system.md` — tokens + signature components
