# syntax=docker/dockerfile:1.7
# Egide web (Next.js 15 App Router, RSC, Server Actions).
# Build context: monorepo root.
#
# Uses Next.js standalone output (cf. apps/web/next.config.mjs) for a
# minimal runtime image. Front-end identity tokens live in @egide/ui
# (workspace dep) so we need the full pnpm monorepo at build time.
#
# Security (cf. ADR 014):
#   - non-root UID 65532
#   - HSTS / X-Frame headers handled in next.config.mjs
#   - HEALTHCHECK on /api/health (Next.js route)

ARG NODE_VERSION=20.18.0

# ─── deps ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/llm-router/package.json packages/llm-router/package.json
COPY packages/messaging/package.json packages/messaging/package.json
COPY packages/oscal/package.json packages/oscal/package.json
COPY packages/policy-targets/package.json packages/policy-targets/package.json
RUN pnpm install --frozen-lockfile --prefer-offline

# ─── build ────────────────────────────────────────────────────────────
FROM deps AS build
COPY apps/web apps/web
COPY apps/api apps/api
COPY packages packages
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/apps/web
RUN pnpm exec next build

# ─── runtime ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
RUN addgroup -S egide -g 65532 \
 && adduser  -S egide -G egide -u 65532 -h /app -s /sbin/nologin
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=65532:65532 /repo/apps/web/public ./public
COPY --from=build --chown=65532:65532 /repo/apps/web/.next/standalone ./
COPY --from=build --chown=65532:65532 /repo/apps/web/.next/static ./apps/web/.next/static
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1
ENTRYPOINT ["node", "apps/web/server.js"]
