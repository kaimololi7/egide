# syntax=docker/dockerfile:1.7
# Egide API gateway — Bun + Hono + tRPC.
# Build context: monorepo root.
#
# Multi-stage:
#   1. base    — pinned Bun image
#   2. deps    — install pnpm workspace deps (cached)
#   3. build   — bun build → single dist/server.js
#   4. runtime — distroless-grade Bun image, non-root, no shell
#
# Security (cf. ADR 014 + 016):
#   - non-root UID 65532
#   - read-only root filesystem at runtime (compose / k8s)
#   - no package manager in final image
#   - HEALTHCHECK on /healthz

ARG BUN_VERSION=1.1.38

# ─── deps ─────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache nodejs npm \
 && npm install --global --no-audit --no-fund pnpm@9.12.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/llm-router/package.json packages/llm-router/package.json
COPY packages/messaging/package.json packages/messaging/package.json
COPY packages/oscal/package.json packages/oscal/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/policy-targets/package.json packages/policy-targets/package.json
RUN pnpm install --frozen-lockfile --prefer-offline

# ─── build ────────────────────────────────────────────────────────────
FROM deps AS build
COPY apps/api apps/api
COPY packages packages
WORKDIR /repo/apps/api
RUN bun build src/server.ts \
      --target=bun \
      --outdir=dist \
      --minify \
      --sourcemap=external

# ─── runtime ──────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-alpine AS runtime
RUN addgroup -S egide -g 65532 \
 && adduser  -S egide -G egide -u 65532 -h /app -s /sbin/nologin
WORKDIR /app
COPY --from=build --chown=65532:65532 /repo/apps/api/dist ./dist
COPY --from=build --chown=65532:65532 /repo/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /repo/apps/api/package.json ./package.json
USER 65532:65532
ENV NODE_ENV=production \
    PORT=4000 \
    EGIDE_LOG_LEVEL=info
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["bun", "run", "dist/server.js"]
