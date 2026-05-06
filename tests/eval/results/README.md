# Eval matrix results

This folder receives the JSON + Markdown reports produced by
`tests/eval/matrix/run_matrix.py`. One pair of files per run, timestamped.

Cf. roadmap.md M5 exit criterion 2 (eval matrix per provider on 50+ fixtures).

## How to populate

```sh
# 1. start the dev infra + apps/api (Better-Auth + LLM router)
docker compose -f deploy/docker/compose.yaml up -d
pnpm --filter @egide/api dev &

# 2. set credentials
export EGIDE_API_URL=http://localhost:3000
export EGIDE_TENANT_ID=00000000-0000-0000-0000-000000000001
export EGIDE_ORCHESTRATOR_TOKEN=<service-account bearer>

# 3. run the matrix
uv run python tests/eval/matrix/run_matrix.py \
  --providers anthropic,mistral,ollama \
  --max-cases 50

# 4. commit the resulting matrix-YYYYMMDD-HHMMSS.{json,md}
```

## Convention

- Reports are committed once per public release (M6 v0.1, M12 v0.5,
  M20 v1.0) so that consumers can audit the deterministic + LLM
  performance tradeoff.
- Single-provider experimental runs MUST be tagged with a `-experimental`
  suffix to avoid being mistaken for canonical reports.
