# Egide — local dev environment

## Bring up the stack

```bash
docker compose -f deploy/docker/compose.yaml up -d
```

This starts:

| Service | Port | Purpose |
|---|---|---|
| `postgres` | 5432 | Operational DB + pgvector RAG (cf. ADR 006 + 007) |
| `clickhouse` | 8123 / 9000 | Audit + telemetry (cf. ADR architecture) |
| `redis` | 6379 | LLM cache, sessions, idempotency keys |
| `nats` | 4222 (client) / 8222 (mon) | Message bus from M1 (cf. ADR 008) |
| `minio` | 9090 (S3) / 9091 (UI) | S3-compatible evidence blobs |

Optional profiles:

```bash
# Start Ollama for local LLM (heavy, ~4-8 GB RAM)
docker compose --profile ai up -d

# Start OTel collector for observability dev
docker compose --profile obs up -d
```

## After first start

1. Apply Row-Level Security policies (after Drizzle migrations):

   ```bash
   psql postgresql://postgres:postgres@localhost:5432/egide \
     -f deploy/scripts/init-db-rls.sql
   ```

2. Pull a local model (if using Ollama profile):

   ```bash
   docker exec egide-ollama ollama pull mistral:7b-instruct
   docker exec egide-ollama ollama pull nomic-embed-text
   ```

## Tear down

```bash
# Keep volumes
docker compose -f deploy/docker/compose.yaml down

# Wipe everything (destructive)
docker compose -f deploy/docker/compose.yaml down -v
```

## Network

All ports bind to `127.0.0.1` — no external exposure. The default
network is `egide-dev` (bridge driver).

## Production

This compose file is **dev only**. Production uses Helm
(`deploy/helm/`), not added yet (lands at M6 with the public release).
