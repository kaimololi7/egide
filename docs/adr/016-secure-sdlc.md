# ADR 016 — Secure SDLC: full-strict from M1

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder
- **Operationalizes**: ADR 014 (security by design), ADR 015 (architecture)

## Context

Egide is a security product. Every line of code shipped is a credibility
statement. A weak supply chain or unsigned releases would invalidate the
sovereign / air-gapped pitch.

The founder chose **full-strict from M1** (vs MVP-pragmatic): cosign
signing, SBOM published, SAST/SCA bloquants in CI from sprint S1. Cost is
~3-5 days of CI setup + ongoing PR discipline.

## Decision

### CI gate matrix (every PR)

Every PR runs the following on GitHub Actions, **bloquant** on
HIGH/CRITICAL:

| Stage | Tool | Languages | Failure threshold |
|---|---|---|---|
| Lint | biome / golangci-lint / ruff | TS / Go / Python | any error |
| Type check | tsc --noEmit / go vet / mypy --strict | TS / Go / Python | any error |
| Unit tests | vitest / go test / pytest | TS / Go / Python | any failure or coverage <80% on changed files |
| Eval (touched agents) | pytest tests/eval | Python | regression vs main |
| SAST | semgrep (with `p/owasp-top-ten` + `p/r2c-security-audit`) | TS, Go, Python | HIGH/CRITICAL |
| SAST Go | gosec | Go | HIGH/CRITICAL |
| SAST Python | ruff (S rules) + bandit | Python | HIGH/CRITICAL |
| Secrets scan | gitleaks | all | any finding |
| SCA dependencies | osv-scanner | all lockfiles | HIGH/CRITICAL |
| Container scan | trivy fs + trivy image | Dockerfiles + built images | HIGH/CRITICAL |
| License audit | go-licenses, license-checker (npm), pip-licenses | all | non-allow-listed license |
| SBOM | syft generate (CycloneDX JSON) | all | always emitted |
| Image build | ko (Go) + buildx (others), distroless base | all services | reproducible build hash |
| Image sign | cosign sign-blob + cosign sign image | release artifacts | signed |
| Helm chart lint | helm lint + kubeconform + datree | helm/ | any error |
| OpenAPI lint | spectral (when REST adapter exists) | api/ | any error |

### Branch policy

- `main` is protected: linear history, signed commits required (`git
  commit -S`), all checks must pass, ≥1 approving review (self-review
  for solo OK with documented intent).
- Feature branches: `feature/<short-desc>` ; merged via squash.
- Hotfix branches: `fix/<short-desc>` ; backported as needed.
- Release tags: `v<MAJOR.MINOR.PATCH>` signed (`git tag -s`).

### Threat modeling per non-trivial feature

Per ADR 014 + the founder's choice (option A): every non-trivial feature
ships a STRIDE threat model file in `docs/threat-models/<feature>.md`.

**Definition of non-trivial**:
- Touches authentication, authorization, multi-tenancy.
- Touches LLM calls, RAG retrieval, prompts.
- Touches generated artifact handling (Rego, Ansible, etc.).
- Touches signing, evidence, audit chain.
- Touches network ingress (new endpoint exposed externally).
- Touches outbound network calls (new external API).

**Trivial features** (no threat model needed): UI text, dependency bumps
without behavior change, refactors with no surface change, formatting,
documentation typos.

When in doubt: write the threat model.

Template at `docs/threat-models/README.md`. Filled file required as part
of the PR.

### Secret management

- **Local dev**: `.env` files in `.gitignore` ; `.env.example` documented
  with non-secret defaults.
- **CI**: GitHub Actions encrypted secrets ; mounted as env at job time.
- **Production self-host**: `sops` + `age` for K8s secrets in git (encrypted)
  ; or KMS (AWS / Scaleway) ; or HashiCorp Vault for Enterprise.
- **No plaintext secrets in containers** : decrypt at startup, hold in
  memory, never log.
- **Rotation**: 90-day default for API tokens ; 1-year for license signing
  keys ; on-demand for incident response.

### Supply chain

- **Container base images**: `gcr.io/distroless/...@sha256:...` pinned
  by digest. Updated by Renovate with explicit PR.
- **Base image rebuild cadence**: weekly (security patches).
- **GitHub Actions**: pinned to commit SHA (`uses: actions/checkout@<sha>`),
  not tag. Renovate updates with PRs.
- **Provenance attestations**: `cosign attest` with SLSA Level 2
  attestation per release.
- **SBOM publication**: published alongside container image (OCI
  artifact) and on release page.
- **Reproducible builds where feasible**: Go services build
  reproducibly (ko deterministic) ; TS and Python harder due to
  dependency graph but pinned exactly.

### Approved licenses

Allow-list for dependencies:

- MIT, BSD-2-Clause, BSD-3-Clause, ISC, Apache-2.0, MPL-2.0
- AGPL-3.0, GPL-3.0 (compatible with our AGPL core)

Forbidden without explicit ADR amendment:

- SSPL, BSL, Commons Clause, Elastic License v2, Confluent Community
- Proprietary (no source) : refused unless air-gapped binary with formal
  review (e.g., bundled OPA binary is Apache 2.0 — OK).

### Pen test policy

- **Yearly external pen test** when first paying customer signs (likely
  M9-M10). Budget 5-10K€/year from revenue.
- **Internal review per major release** (M6 v0.1, M12 v0.5, M20 v1.0):
  threat model walkthrough + manual review of critical paths.
- **Bug bounty program** when public release matures (M9+) via YesWeHack
  (FR sovereign) or Intigriti.
- **Disclosure policy**: 90-day responsible disclosure standard ; CVE
  assignment for confirmed vulnerabilities ; security advisories on GitHub.

### Vulnerability response

- `SECURITY.md` at repo root: PGP-encrypted email
  `security@egide.io` (when domain claimed).
- 24h acknowledgment SLA ; 14d initial assessment.
- Critical vulns: hotfix on supported releases ; coordinated disclosure.
- Subscribe to OPA / Kyverno / Ansible / Anthropic / Mistral security
  advisories ; quarterly review.

### Backups and restore

- PG backups: pgBackRest in production ; daily full + WAL archive.
  Retention 30 days Community / 90 days Pro / 1 year Enterprise.
- ClickHouse: native `BACKUP TABLE` to S3.
- Restore tested quarterly (game day) ; documented in
  `deploy/scripts/restore.sh`.

### Incident response (Egide as a NIS2 subject)

Egide will likely fall under NIS2 once it has paying customers in
regulated sectors. Internal IR plan:

- Severity matrix (critical/high/medium/low) defined.
- IR runbook in `docs/runbooks/incident-response.md` (to write before
  M6).
- Post-incident review : public post-mortem for customer-facing
  incidents, internal-only for near-misses.
- Customer notification: 24h initial within scope, 72h detailed (NIS2
  Art. 23 alignment).

## Consequences

- `.github/workflows/ci.yml` carries the full pipeline above from
  sprint S1.
- `.github/PULL_REQUEST_TEMPLATE.md` includes the OWASP / LLM checklist
  and the threat model link field.
- `SECURITY.md` and `CODE_OF_CONDUCT.md` and `CONTRIBUTING.md` ship
  before public release (M6).
- Build infra cost: GitHub Actions free tier insufficient past M3 ;
  budget ~50-200€/month for paid runners as code grows.
- Solo dev discipline: every PR self-reviewed against the checklist
  before merge ; cannot merge with red CI.
- Documentation overhead: ~30-45 min per non-trivial feature for the
  threat model ; acceptable cost for the credibility benefit.

## Open questions

- Self-hosted Gitea + Drone instead of GitHub for sovereign concerns?
  Defer to M9 ; mirror to GitHub for discoverability.
- SLSA Level 3 (provenance with hardened builders) by M12? Probably
  yes ; requires Sigstore TUF setup.
