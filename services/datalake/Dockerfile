# syntax=docker/dockerfile:1.7
# Egide datalake — Go service writing to ClickHouse.
# Build context: monorepo root.

ARG GO_VERSION=1.23

# ─── builder ──────────────────────────────────────────────────────────
FROM golang:${GO_VERSION}-alpine AS build
RUN apk add --no-cache ca-certificates git
ENV CGO_ENABLED=0 GOOS=linux GOWORK=off
WORKDIR /src
COPY services/datalake/go.mod ./
COPY services/datalake/go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY services/datalake/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ─── runtime ──────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=build /out/server /server
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/server"]
