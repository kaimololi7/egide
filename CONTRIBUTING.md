# Contributing to Egide

Thanks for considering a contribution. Read this before opening a PR.

> **Status**: Egide is in pre-MVP solo-author scaffolding (M0). External
> contributions are welcome but expect slow review until M6 (public
> release). After M6, response time becomes our priority.

## Code of conduct

By participating, you agree to abide by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Licensing and DCO

Egide source code is **AGPL-3.0-only**. Contributions are accepted under
the **Developer Certificate of Origin** (DCO), version 1.1. Sign each
commit with `git commit -s`. We do **not** require a CLA.

For commercial features (Pro/Enterprise editions), see
[`LICENSE-COMMERCIAL.md`](LICENSE-COMMERCIAL.md). The same dual-license
approach applies.

## Before you open a PR

Read at least:

- [`CLAUDE.md`](CLAUDE.md) — project conventions and non-negotiables
- The ADR(s) relevant to the area you touch
  ([list](docs/adr/))
- [`docs/architecture-principles.md`](docs/architecture-principles.md) — coding patterns
- [`docs/security.md`](docs/security.md) — security operational guide

For non-trivial features, also read:

- [`docs/threat-models/README.md`](docs/threat-models/README.md) — when and how to add a threat model
- [`docs/design-system.md`](docs/design-system.md) — if you touch the front

## Branches and commits

- Branches: `feature/<short-desc>` or `fix/<short-desc>`.
- Commits: `type(scope): description` — `feat`, `fix`, `refactor`,
  `docs`, `test`, `chore`, `ci`.
- Sign commits: `git commit -s -S`.
- Squash merge into `main`.

## What requires a threat model

Per ADR 016: any change touching authentication, authorization,
multi-tenancy, LLM calls, RAG, generated artifacts, signing, evidence,
new ingress, new outbound network calls, cryptographic primitives, or
tenant-scoped persistence.

Add the threat model file in `docs/threat-models/<slug>.md` using the
template in `docs/threat-models/README.md`. Link it in the PR.

## CI gates (must all pass)

- Lint + typecheck + tests (TS / Go / Python as relevant)
- semgrep (OWASP + r2c rules)
- gitleaks (secrets)
- osv-scanner (dependencies)
- trivy filesystem scan
- License audit (allow-list per ADR 016)

A red CI blocks merge. Do not skip checks. If a check is wrong, fix the
check first (ADR amendment if needed).

## Style

- **English** for code, comments, commit messages, identifiers.
- **French primary** for user-facing strings, marketing copy, end-user
  docs (cf. CLAUDE.md).
- Linting is enforced: `biome` (TS), `golangci-lint` (Go), `ruff` +
  `mypy strict` (Python).
- No emojis in files unless explicitly requested.

## Anti-patterns we reject

- Introducing a forbidden tool (LangChain, Temporal, Neo4j, Kafka,
  Elasticsearch, MongoDB, HashiCorp Sentinel — see CLAUDE.md) without
  an ADR amendment.
- AI-generated images or copywriting hype words (`AI-powered`, `unlock`,
  `seamless`, `10x your X`, etc. — see ADR 017).
- Box-shadow elevation, decorative animation, border radius > 8px in
  the front (cf. ADR 017).
- Skipping the threat model on a security-relevant change.
- Using a generic `helpers.ts` / `utils.go` growing beyond 100 LOC.

## Getting help

- GitHub Discussions (post-M6): https://github.com/egide/egide/discussions
- Discord / Matrix (post-M6): announced on the README.
- Direct contact: hello@egide.io (response time: best-effort until M6).

## Local development

```bash
# Clone and configure
git clone https://github.com/egide/egide.git
cd egide
cp .env.example .env

# Start backing services
docker compose -f deploy/docker/compose.yaml up -d

# Install workspaces
pnpm install
go work sync
uv sync --all-extras --dev

# Run
pnpm dev               # web + api
go run ./services/...  # Go services
uv run python -m ...   # Python services
```

See `STATUS.md` for what currently works (most services are scaffold
only at M0).

## Recognition

Contributors are listed in `CONTRIBUTORS.md` (auto-generated from
sign-offs). Security researchers in `SECURITY-CREDITS.md`.
