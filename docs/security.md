# Egide — Security overview (operational)

This document is the **operational** companion to ADR 014 (security by
design) and ADR 016 (secure SDLC). It is the single document a new
contributor reads to understand how Egide enforces security in practice.

> **Audience**: contributors, security auditors, prospective customers
> doing technical due-diligence.

## TL;DR

- **OWASP Web Top 10 (2021)** and **OWASP LLM Top 10 (2025)** mapping
  with concrete controls : ADR 014.
- **Secure SDLC**: SAST + SCA + signing + SBOM full-strict from M1 :
  ADR 016.
- **Threat models** per non-trivial feature : `docs/threat-models/`.
- **Architecture principles** that enable security boundaries : ADR 015.

## Threat surface — by component

| Component | Primary threats | Documented in |
|---|---|---|
| `apps/web` | XSS, CSRF, session hijacking, clickjacking | `docs/threat-models/web-app.md` |
| `apps/api` | broken auth, broken access control, SSRF, IDOR | `docs/threat-models/api-gateway.md` |
| `apps/cli` | local secret exfiltration, malicious config | `docs/threat-models/cli.md` |
| `services/extractor` | malicious documents (PDF parsers exploits, zip bombs) | `docs/threat-models/document-extraction.md` |
| `services/validator` | malicious pyramid input, DoS via huge graphs | `docs/threat-models/pyramid-validation.md` |
| `services/compiler` | malicious TAI Intent → malicious generated artifact | `docs/threat-models/policy-compilation.md` |
| `services/pipeline` (collectors) | credential theft, SSRF to internal infra | `docs/threat-models/collectors.md` |
| `services/datalake` | audit log tampering, query DoS | `docs/threat-models/audit-trail.md` |
| `agents/*` (AI workers) | prompt injection, data exfiltration, excessive agency | `docs/threat-models/ai-workers.md` |
| `edge/agent` | mTLS bypass, posture-data leakage | `docs/threat-models/edge-agent.md` |
| LLM Router | prompt leakage, cost DoS, provider compromise | `docs/threat-models/llm-router.md` |
| Multi-tenancy | cross-tenant data leakage, RLS bypass | `docs/threat-models/multi-tenant-isolation.md` |

Each model file follows the template at
`docs/threat-models/README.md` and is linked from the corresponding
PR(s).

## Security-relevant configuration

### Required environment variables in production

| Variable | Purpose | Required |
|---|---|---|
| `EGIDE_EDITION` | community / professional / enterprise | yes |
| `EGIDE_LICENSE_KEY` | Ed25519-signed license payload | if non-community |
| `POSTGRES_URL` | Postgres connection (TLS required in prod) | yes |
| `POSTGRES_RLS_ENFORCE` | enable Row-Level Security policies | yes (prod) |
| `S3_KMS_KEY_ID` | KMS key for evidence blob encryption | yes (prod) |
| `EGIDE_SIGNING_KEY_PATH` | Ed25519 private key for artifact signing | Enterprise |
| `EGIDE_TENANT_DEK_WRAP_KEY_PATH` | server master key wrapping per-tenant DEKs | yes |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | observability collector | yes (prod) |
| `EGIDE_AI_MODE` | template_only / byok / local / hybrid | yes |
| `EGIDE_PRIVACY_MODE` | strict (local-only LLM) / standard | yes |

### Secrets that must NEVER be in env

- Per-tenant LLM API keys → encrypted at rest in `tenants.ai_config_encrypted`
- Per-tenant collector credentials → encrypted in `integrations.config_encrypted`
- User passwords → never in env, only hashed in DB
- TLS private keys → in K8s secrets via sops/age, mounted as files

## Per-PR security checklist

Every PR template includes (see `.github/PULL_REQUEST_TEMPLATE.md`):

```markdown
## Security checklist
- [ ] No secrets, keys, or credentials added to the codebase.
- [ ] Authorization checks added/reviewed for new endpoints.
- [ ] Input validation at trust boundaries (parsing, deserialization).
- [ ] Output sanitization where rendered (HTML, logs, LLM prompts).
- [ ] OWASP Web Top 10 items considered (link to ADR 014 §A0X if relevant).
- [ ] OWASP LLM Top 10 items considered (link to ADR 014 §LLM0X if LLM-touching).
- [ ] Threat model file added/updated in `docs/threat-models/` (if non-trivial).
- [ ] Tests cover the change (unit + integration + adversarial when relevant).
- [ ] Audit log entries added for new security-relevant actions.
```

## How to add a new external dependency

1. Check license is in the allow-list (ADR 016).
2. Run `osv-scanner --lockfile <lockfile>` against the candidate version.
3. Pin exact version (no caret/tilde unless justified in PR description).
4. If the dep introduces a new attack surface (network, deserialization,
   crypto), open or amend the relevant threat model.
5. Add to SBOM (auto via syft).

## How to add a new LLM provider

1. Implement the `LLMProvider` interface (ADR 004).
2. Pin TLS root certificates in `packages/llm-router/src/providers/<name>/roots.ts`.
3. Document the threat model in `docs/threat-models/llm-router.md`
   (cost vector, data residency, cert pinning, refusal behavior).
4. Add eval fixtures and run the full eval matrix (ADR 009).
5. Update `docs/eval-results.md`.

## How to add a new AI worker tool

1. Declare metadata: `read_only`, `requires_approval`, `tenant_scoped`,
   `cost_class`.
2. Implement as a pure Python function with Pydantic input/output
   schemas.
3. Add to the agent's tool whitelist explicitly (no auto-discovery).
4. Write unit tests + adversarial fixtures (prompt injection trying to
   misuse the tool).
5. Update `docs/threat-models/ai-workers.md`.

## How to add a new compiler target

1. Implement `Generator` interface in
   `services/compiler/internal/generators/<target>/`.
2. Sandbox the native engine call (`opa`, `kyverno`, etc.) — no shell
   metacharacters from input.
3. Compute artifact `content_hash` ; sign in Enterprise.
4. Update `docs/threat-models/policy-compilation.md` with the new
   generator's threat surface.
5. Add fixture-based tests + integration test in CI.

## Vulnerability reporting

See `SECURITY.md` at the repo root (to add before public release).

PGP-encrypted email to `security@egide.io` (when domain claimed).
24h acknowledgment SLA. 90-day responsible disclosure.

## Periodic reviews

- **Weekly**: Dependabot / Renovate PR triage ; osv-scanner findings.
- **Monthly**: review production logs for anomalies ; verify backup
  restore in dev.
- **Quarterly**: review of the threat model files ; refresh outdated
  controls ; tabletop exercise on incident response.
- **Yearly**: external pen test (when first paying customer signed) ;
  full SBOM audit ; license-allow-list revision.

## References

- ADR 014 — Security by design (OWASP mapping)
- ADR 015 — Architectural principles (security-enabling structure)
- ADR 016 — Secure SDLC (CI tooling and process)
- `docs/threat-models/` — per-feature STRIDE models
- OWASP Top 10 — 2021 : <https://owasp.org/Top10/>
- OWASP Top 10 for LLM Applications 2025 :
  <https://genai.owasp.org/llm-top-10/>
- ANSSI guides : <https://cyber.gouv.fr/publications>
