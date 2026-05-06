# syntax=docker/dockerfile:1.7
# Egide CLI (`egide`) — Bun single binary.
# Build context: monorepo root.
#
# Produces a self-contained executable via `bun build --compile`.
# Runtime image is distroless-grade and ships only the binary.

ARG BUN_VERSION=1.1.38

# ─── deps ─────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache nodejs npm \
 && npm install --global --no-audit --no-fund pnpm@9.12.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/cli/package.json apps/cli/package.json
RUN pnpm install --frozen-lockfile --prefer-offline --filter @egide/cli...

# ─── build ────────────────────────────────────────────────────────────
FROM deps AS build
COPY apps/cli apps/cli
WORKDIR /repo/apps/cli
RUN mkdir -p dist \
 && bun build src/index.ts \
      --target=bun \
      --outfile=dist/egide \
      --compile \
      --minify

# ─── runtime ──────────────────────────────────────────────────────────
# alpine because users typically `docker run --rm egide cli ...`
# interactively and need a shell entry point. No build tools installed.
FROM alpine:3.20 AS runtime
RUN apk add --no-cache ca-certificates \
 && addgroup -S egide -g 65532 \
 && adduser  -S egide -G egide -u 65532 -h /home/egide -s /sbin/nologin
COPY --from=build --chown=65532:65532 /repo/apps/cli/dist/egide /usr/local/bin/egide
USER 65532:65532
WORKDIR /home/egide
ENV EGIDE_LOG_LEVEL=info
ENTRYPOINT ["/usr/local/bin/egide"]
CMD ["--help"]
