# @egide/api

Bun + Hono + tRPC + Better-Auth + OTel API gateway. Implements ADR 015
(architecture / 5 bounded contexts) and ADR 014 (security headers,
CORS, error scrubbing).

## Status

Scaffold. Boots, exposes `/health` + `/health/ready` + `/health/version`,
mounts tRPC at `/trpc/*` with 5 bounded context routers (pyramid,
compilation, compliance, audit, governance) returning placeholders.

Better-Auth integration + tenant context middleware land at M1 sprint S2.

## Run

```bash
# Set required env (cf. src/env.ts)
export POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/egide
export REDIS_URL=redis://localhost:6379
export NATS_URL=nats://localhost:4222
export BETTER_AUTH_SECRET=$(openssl rand -hex 32)
export BETTER_AUTH_URL=http://localhost:3001

bun --watch src/server.ts
# or via pnpm
pnpm --filter @egide/api dev
```

Then:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/version
```

## Layout

```
src/
├── server.ts                    # Bun + Hono bootstrap, security headers, error handler
├── trpc.ts                      # tRPC root router with v1 namespace
├── env.ts                       # Zod-validated environment
├── shared/
│   └── logger.ts                # pino with PII redaction
├── middleware/                  # auth + tenant context (M1 S2)
└── contexts/                    # 5 bounded contexts + health
    ├── health/routes.ts         # Hono routes (no auth)
    ├── pyramid/router.ts        # tRPC subrouter
    ├── compilation/router.ts
    ├── compliance/router.ts
    ├── audit/router.ts
    └── governance/router.ts
```

## Reference

- ADR 014 — Security by design
- ADR 015 — Architectural principles
- `docs/threat-models/api-gateway.md`
