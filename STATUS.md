# Egide — Current status

**Phase**: M0 — Foundation
**Date**: 2026-05-04

## What is in this repo right now

- Documentation only. **No application code yet.**
- Monorepo structure scaffolded: `apps/`, `services/`, `agents/`, `edge/`,
  `packages/`, `ontologies/`, `deploy/`, `docs/`.
- Root manifests: `package.json` (pnpm workspace), `pnpm-workspace.yaml`,
  `turbo.json`, `go.work`, `pyproject.toml` (uv workspace).
- License: AGPL-3.0-only (`LICENSE`) + commercial placeholder (`LICENSE-COMMERCIAL.md`).
- Five ADRs gravé:
  - 001 Foundation (positioning, audience, scope)
  - 002 Licensing (AGPL + commercial dual)
  - 003 Stack (TS + Go + Python)
  - 004 Multi-LLM router with degraded-mode-without-AI
  - 005 Policy-as-Code multi-target compiler
- Architecture, roadmap, editions matrix, migration plan, Intent IR spec.

## What is NOT in this repo yet

- Any source code (the `apps/`, `services/`, `agents/`, `edge/`, `packages/`,
  `ontologies/clusters/` directories are empty placeholders).
- Migrated content from `~/dev/process-pyramid/` and
  `~/projects/aegis-platform/`. See `docs/migration.md` for the plan.
- CI configuration.
- Docker Compose dev environment.
- `.claude/skills/` migrated from `process-pyramid`.

## Next concrete actions (M1, weeks 1–2 of the roadmap)

1. Initialize git repo (`git init`, first commit).
2. Set up GitHub Actions skeleton (lint TS + Go + Python).
3. Migrate ontologies (10 YAML clusters from `process-pyramid`).
4. Migrate Drizzle DB schema and extend with new tables.
5. Migrate `.claude/skills/` and add new skills (HDS, OPA, Kyverno, Ansible).
6. Stand up Docker Compose dev environment (Postgres + ClickHouse + Redis + Ollama).
7. Initialize `apps/api` (Bun + Hono + tRPC scaffolding).
8. Initialize `packages/llm-router` with Anthropic + Ollama providers.

After that: extractor (Python), compliance agent (Python), validator port (Go).

## How to use this repo today

This repository is meant to be **read** before any code is written. Future
Claude Code sessions should:

1. Open this `STATUS.md`.
2. Read `CLAUDE.md` for principles.
3. Read the relevant ADR before touching a service.
4. Consult `docs/migration.md` for "where does X come from".
5. Update this `STATUS.md` whenever a phase completes.

## Source repositories (frozen, not deleted)

- `~/dev/process-pyramid/` — frontend + ontologies + Python validator. Do
  not commit there. Read-only reference.
- `~/projects/aegis-platform/` — Go services + Python agent framework + edge
  agent. Do not commit there. Read-only reference.

Both remain on disk as a fallback if a migration choice proves wrong.
