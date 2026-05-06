# `apps/landing` — public marketing site

Standalone Next.js 15 site, **static export only**, deployable to any
static host.

## Why a separate workspace from `apps/web`

`apps/web` is the authenticated product UI (Next.js + tRPC + Better-Auth +
DB). It cannot be statically exported and would be over-provisioned for
the landing.

`apps/landing` ships:

- 1 page (`/`)
- 0 server runtime
- 0 third-party tracker (Plausible / Umami can be added when needed)
- 0 external CDN (fonts come from `@egide/ui`)

## Architecture

- **Framework**: Next.js 15 App Router with `output: "export"`.
- **Tokens**: imports `@egide/ui/styles/tokens.css` and `base.css`. No
  inline colors, no inline fonts (cf. ADR 017).
- **Components**: 7 React server components, no client-side JS beyond what
  Next ships by default.
- **Icons**: lucide-react (allowed per design system).

## Anti-AI-slop guardrails (cf. ADR 017)

Forbidden in this codebase:

- aurora / mesh gradient / orb glow / sparkles / beams
- decorative animation > 200ms
- icons in colored circles
- carousels, autoplay, parallax
- "AI-powered", "supercharge", "next-generation", etc. in copy
- third-party logos as social proof unless real and authorised

## Develop

```bash
pnpm --filter @egide/landing dev      # http://localhost:3100
pnpm --filter @egide/landing build    # → out/
pnpm --filter @egide/landing typecheck
```

## Deploy

The static `out/` directory can be served by any static host. Per ADR
017, the production target is **Scaleway Object Storage + Edge** or
**OVH Web Cloud** — not Vercel, not GitHub Pages, not Netlify.

### Scaleway example

```bash
pnpm --filter @egide/landing build
aws --profile scaleway --endpoint-url https://s3.fr-par.scw.cloud \
    s3 sync apps/landing/out/ s3://egide-landing/ --delete
# Configure Scaleway Edge in front of the bucket for HTTPS + caching.
```

### Security headers

Static export does not emit security headers. Configure them at the edge:

| Header | Value |
|---|---|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `no-referrer` |
| Content-Security-Policy | `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` |
