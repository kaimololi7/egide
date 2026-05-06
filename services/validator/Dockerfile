# syntax=docker/dockerfile:1.7
# Egide validator service — Go hexagonal (cf. ADR 015).
# Build context: monorepo root.
#
# Per-service go.mod is self-contained; we disable go.work in the
# builder so the build only sees the validator module.

ARG GO_VERSION=1.25
ARG SERVICE=validator

# ─── builder ──────────────────────────────────────────────────────────
FROM golang:${GO_VERSION}-alpine AS build
RUN apk add --no-cache ca-certificates git
ENV CGO_ENABLED=0 GOOS=linux GOWORK=off
WORKDIR /src
COPY services/validator/go.mod services/validator/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY services/validator/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ─── runtime ──────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=build /out/server /server
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/server"]
