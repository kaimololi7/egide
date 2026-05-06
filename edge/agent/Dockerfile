# syntax=docker/dockerfile:1.7
# Egide edge agent — cross-platform Go binary, mTLS, posture collector.
# Build context: monorepo root.

ARG GO_VERSION=1.23

# ─── builder ──────────────────────────────────────────────────────────
FROM golang:${GO_VERSION}-alpine AS build
RUN apk add --no-cache ca-certificates git
ENV CGO_ENABLED=0 GOOS=linux GOWORK=off
WORKDIR /src
COPY edge/agent/go.mod ./
COPY edge/agent/go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY edge/agent/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/agent ./cmd/server

# ─── runtime ──────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=build /out/agent /agent
USER 65532:65532
EXPOSE 8443
ENTRYPOINT ["/agent"]
