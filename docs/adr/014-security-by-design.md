# ADR 014 — Security by design: OWASP Web Top 10 (2021) + OWASP LLM Top 10 (2025)

- **Status**: Accepted
- **Date**: 2026-05-05
- **Deciders**: solo founder
- **Mandatory for**: every component, every PR, every release

## Context

Egide builds GRC tooling for a security-conscious technical persona
(ADR 013). Security must be **structural**, not bolted on. Two
authoritative checklists frame the approach:

- **OWASP Top 10 — 2021** for traditional web app risks.
- **OWASP Top 10 for LLM Applications — 2025** for AI-specific risks.

Both are mandatory references. Each item below maps to **concrete
controls** in Egide and is enforced via tooling defined in ADR 016.

## Decision

### OWASP Web Top 10 (2021)

#### A01 — Broken Access Control

**Threats**: cross-tenant data leak, privilege escalation, unauthorized
artifact mutation.

**Controls**:
- Multi-tenant isolation via `tenant_id` column on every operational
  table + Postgres Row-Level Security policies in production
  (`deploy/scripts/init-db-rls.sql`).
- RBAC enforced in `apps/api` middleware on every tRPC procedure
  (admin / process_owner / auditor / operator / viewer).
- Deny-by-default on every new endpoint; explicit `requireRole()` + `requireFeature()` calls.
- Object-level authorization checks at repository boundary (the
  `tenantId` is never trusted from the client; always taken from the
  authenticated session).
- E2E tests assert that user A from tenant X cannot read/mutate
  resources of tenant Y.

#### A02 — Cryptographic Failures

**Controls**:
- Ed25519 for all signing (license keys, evidence chain, approval
  signatures, artifact bundles).
- TLS 1.3 minimum on all external endpoints; `tls_skip_verify` is
  forbidden in production code paths (build-time check via semgrep).
- mTLS for service-to-service in production (Helm chart manages
  cert-manager rotation).
- Secrets at rest: KMS (AWS / Scaleway) or local `age` key file in
  on-prem; never in env vars in production (only at boot).
- Tenant data at rest: bring-your-own-key option in Pro+; default is
  per-tenant data encryption key (DEK) wrapped by a server master key.
- Passwords: argon2id via Better-Auth defaults.
- No custom crypto. Ever. Use libsodium / golang.org/x/crypto / nacl /
  Noble.

#### A03 — Injection

**Controls**:
- SQL: Drizzle parameterized queries only ; no string concatenation.
  semgrep rule blocks `db.execute(\`...\`)` with template literals.
- Command: never `child_process.exec` with user input. `execFile` with
  array args only. semgrep rule enforces.
- Template: React JSX auto-escapes ; no `dangerouslySetInnerHTML` without
  DOMPurify wrapping.
- LDAP / NoSQL / GraphQL injection: not applicable (we use neither).
- **Compiler input**: TAI Intents are validated against JSON Schema
  before generation. Generators use parameterized templates, never
  string-template the user input directly into Rego/Ansible/etc.

#### A04 — Insecure Design

**Controls**:
- Threat modeling (STRIDE) per non-trivial feature ; one file per feature
  in `docs/threat-models/`. Required before implementation PR opens.
- Secure defaults : every config option defaults to the safest value;
  insecure choices require explicit opt-in.
- Defense in depth : multi-tenant isolation is enforced at app layer AND
  PG RLS AND test harness.
- Principle of least privilege: AI worker tools whitelisted; OS
  processes run as non-root; container drops all capabilities.

#### A05 — Security Misconfiguration

**Controls**:
- Distroless container base for all services (no shell, no package
  manager in image).
- Helm chart values linted ; defaults enforce `runAsNonRoot`,
  `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`,
  `capabilities.drop: [ALL]`.
- Network policies in K8s: default deny ; explicit allow per service pair.
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers set on
  `apps/web` via Next.js middleware.
- Error responses scrubbed (no stack traces in prod).
- Admin interfaces (Drizzle Studio, NATS UI) bound to localhost only
  in prod; accessed via SSH tunnel.

#### A06 — Vulnerable and Outdated Components

**Controls**:
- Dependabot / Renovate for `pnpm`, `go.mod`, `pyproject.toml`. Auto-PR
  on patch, manual review on minor/major.
- `osv-scanner` in CI on every PR ; HIGH/CRITICAL fail the build.
- SBOM generated per release with `syft` (CycloneDX format), published
  alongside container images.
- Pinned exact versions: `pnpm-lock.yaml`, `go.sum`, `uv.lock` are
  authoritative ; CI rejects unpinned `latest` tags or version ranges
  without `~` / `^` justification.
- Container base images pinned by **digest** (`@sha256:...`), not tag.

#### A07 — Identification and Authentication Failures

**Controls**:
- Better-Auth with: argon2id passwords, rate-limited login (10/min/IP),
  account lockout after 5 failed attempts (10 min), session rotation,
  CSRF tokens.
- TOTP MFA available in Community ; mandatory in Pro+ ; WebAuthn in
  Enterprise.
- Session cookies: `Secure`, `HttpOnly`, `SameSite=Lax`, scoped
  to host.
- API tokens: scoped per tenant, hashed at rest, rotated every 90 days.
- Edge agents: mTLS with per-tenant certificate; cert pinning via
  fingerprint or CA pin.

#### A08 — Software and Data Integrity Failures

**Controls**:
- Container images signed with **cosign** (Sigstore) ; signature
  verified at deploy time via Helm hook.
- Compiled artifact bundles (Rego, Ansible, etc.) signed Ed25519 in
  Enterprise; signature embedded in the bundle manifest.
- Evidence blobs hash-chained: each new blob's `prev_hash` references
  the previous blob's `content_hash` (Merkle linear chain).
- Pyramid versions: `content_hash` of `graph_snapshot` stored ; mutation
  bound to parent hash ; tampering detectable on diff.
- CI/CD: GitHub Actions workflows pinned to commit SHA, not tag (`uses:
  actions/checkout@<sha>`).

#### A09 — Security Logging and Monitoring Failures

**Controls**:
- Audit log on every security-relevant action (login, logout, role
  change, license check, approval request, approval signature, settings
  change, secret rotation). Stored in `audit_logs` (PG) for 1 year
  Pro / unlimited Enterprise.
- Structured logs (JSON) with `trace_id`, `tenant_id`, `actor_id` on
  every line.
- Alerts on: repeated failed logins, license verification failures,
  unexpected `tls_skip_verify` usage, abnormal LLM cost burn, edge
  agent disconnections > 1h.
- LLM call audit (cf. ADR 004): provider, model, tokens, cost, latency,
  pyramid_id, journey_phase, worker_name. Every call logged.
- ClickHouse retention: 30 days Community / 1 year Pro / unlimited
  Enterprise.

#### A10 — Server-Side Request Forgery (SSRF)

**Controls**:
- LLM provider URLs: configured per tenant from a **server-side allow-list**;
  user input cannot redirect a call to an arbitrary host.
- Document extraction: uploaded files only (no URL fetch in MVP). If we
  add URL fetch later, use an outbound proxy with allow-list per tenant.
- Edge agent endpoints: pinned by tenant config, not user-supplied.
- HTTP clients refuse: link-local (169.254.0.0/16), loopback, RFC1918
  ranges by default ; explicit per-tenant override required for on-prem
  collectors (Proxmox, Ansible inventory).

### OWASP Top 10 for LLM Applications (2025)

#### LLM01 — Prompt Injection

**Threats**: malicious document content makes the AI worker leak
secrets, bypass policies, or take harmful actions.

**Controls**:
- Strict separation of trust zones: **system prompt** (trusted), **tool
  results** (semi-trusted, validated), **user/document content**
  (untrusted, sandboxed).
- Document content always wrapped in `<untrusted_content>...</untrusted_content>`
  XML tags in prompts ; system prompt instructs the model not to follow
  instructions inside.
- AI workers have a **whitelist of tools** they can call (cf. ADR 011);
  no `shell`, no `eval`, no arbitrary HTTP. New tool requires ADR amendment.
- Output validation: every tool output passing back to the agent is
  Pydantic-validated; structural mismatch = reject.
- Adversarial fixtures in eval suite (ADR 009) covering known prompt
  injection patterns ; tracked over time.
- Audit log on every tool call with full input/output.

#### LLM02 — Sensitive Information Disclosure

**Controls**:
- PII scrubber pre-prompt: emails, IPs, secrets-like patterns replaced
  with placeholders before sending to cloud LLM. Tenant can disable for
  local-only providers.
- Customer secrets (API keys in `integrations.config_encrypted`,
  passwords, TLS material) **never** assembled into a prompt. Codified
  by repository pattern: secrets accessed only via `SecretsService`,
  which enforces no-prompt-context flag.
- LLM output sanitized for accidental disclosure (e.g., a model that
  echoes back a prompt fragment containing a secret) before returning to client.
- For sovereign-strict tenants (`ai_engine.privacy_mode: strict`), all
  LLM calls route to local providers (Ollama/vLLM) only ; cloud
  providers blocked at router level.

#### LLM03 — Supply Chain (training data, models)

**Controls**:
- Cloud LLM providers (Anthropic, Mistral, Scaleway, OVH) accessed
  over TLS 1.3 with cert pinning at provider's published roots.
- Local models (Ollama) pulled by **digest**, not tag. Manifest of
  approved models tracked in `deploy/models/manifest.json`.
- Air-gapped Enterprise: bundled models shipped with SHA256 in install
  bundle ; verified at install time.
- Embedding models: same policy ; per ADR 007, embed providers
  declared in tenant config from a server-side allow-list.

#### LLM04 — Data and Model Poisoning

**Controls**:
- Ontology RAG corpus is **read-only at runtime** for AI workers ; only
  the offline ingestion script (`services/extractor/ingest_ontologies.py`)
  writes ; CI ensures cluster YAMLs pass schema validation before merge.
- Custom tenant ontologies (Pro+): isolated by `tenant_id` ; never
  merged into the global corpus.
- Each ontology chunk carries a `source_signature` (Ed25519, signed by
  the maintainer key); RAG retriever returns chunks with verifiable
  provenance ; tampered chunks rejected at query time.
- LLM-as-judge outputs are **never** auto-applied as ground truth ; they
  augment human review and feed eval datasets only via explicit curation.

#### LLM05 — Improper Output Handling

**Controls**:
- Every LLM output passes a **structured validator** (Pydantic + JSON
  Schema) before any further processing. Loose strings rejected.
- Outputs are **never** passed to `eval()`, `exec()`, `os.system`,
  `subprocess.shell=True`, or template engines without escaping.
- Generated artifacts (Rego, Ansible) are syntactically validated by
  the native engine (`opa parse`, `ansible-lint`) before being saved
  or returned.
- HTML rendered from LLM output sanitized via DOMPurify (TS) /
  `bleach` (Python) before render. By default, LLM output is rendered
  as plain text or markdown (no raw HTML).

#### LLM06 — Excessive Agency

**Controls**:
- Tool whitelist per AI worker, declared in code, audited in ADR 011.
- **No tool that can mutate production state** is callable by the LLM
  without an approval workflow (ADR 010). Apply Ansible (J9) requires
  explicit human signature.
- Each tool declares: `read_only: true|false`, `requires_approval: true|false`,
  `tenant_scoped: true|false`, `cost_class: cheap|expensive`. The agent
  framework enforces these at call time.
- `agents/orchestrator` is **not an LLM agent**; it is a deterministic
  state machine (ADR 011). LLM never drives orchestration directly.
- AI worker timeout per tool call (default 60s); exceeded → cancel + log.

#### LLM07 — System Prompt Leakage

**Controls**:
- System prompts treated as **secrets** ; stored in
  `prompts/<worker>/<version>.md`, loaded at boot ; never returned in
  API responses.
- Output scrubber strips known prompt fragments and any line starting
  with `<system>`, `<instructions>`, etc.
- Eval framework includes "prompt extraction attempt" fixtures; agent
  must refuse.
- Versioned and signed: each prompt carries a hash recorded in
  `llm_calls.system_prompt_hash` for audit.

#### LLM08 — Vector and Embedding Weaknesses

**Controls**:
- `ontology_chunks` table partitioned by `tenant_id` ; queries always
  filter by tenant + `NULL` (global). Cross-tenant retrieval impossible
  by construction.
- Custom tenant ontologies validated at ingestion (schema + signature)
  before embedding.
- Embedding model per provider is logged in `ontology_chunks.embed_model`
  ; mismatched query model returns `EMBED_MODEL_MISMATCH` error rather
  than silently degraded results.
- Periodic re-embedding when an embedding model is upgraded ; old
  vectors retained for one rotation cycle then purged.
- Adversarial embedding tests in eval suite (similar but semantically
  inverted texts must not retrieve the same chunks).

#### LLM09 — Misinformation (hallucination propagation)

**Controls**:
- Hallucination guard mandatory (cf. ADR 007 + 011): every output
  citing an `anchor_ref` is verified against `ontology_chunks.anchor_ref`.
- Coherence rules (ADR 006) catch downstream inconsistencies after
  generation.
- LLM-as-judge results are **observations**, not facts ; surfaced in UI
  with confidence + provenance.
- Eval framework measures hallucination rate per provider/model;
  published in `docs/eval-results.md`.
- User-facing UI never claims certainty for AI-generated content; every
  AI artifact carries a "draft, review needed" badge until a human
  signs off.

#### LLM10 — Unbounded Consumption

**Controls**:
- Per-tenant **monthly budget cap** in USD micro-units (cf. ADR 004) ;
  router refuses calls past cap with a clear UI message.
- Per-tenant **request rate limit** (default: 60 LLM calls/min, 1000
  embed calls/min) ; configurable per edition.
- Per-call **token cap** (input ≤ 100K, output ≤ 16K by default).
- Streaming responses enforced for long generations (no >60s blocking
  call).
- DoS-of-self protection: a stuck job in NATS DLQ does not retry
  indefinitely (MaxDeliver = 5).
- Cost anomaly alert: spike > 3× rolling 7-day average triggers a
  notification.

## Consequences

- ADR 016 (secure SDLC) operationalizes these controls in CI tooling.
- Every PR fills a checklist (template in `.github/PULL_REQUEST_TEMPLATE.md`)
  confirming the relevant OWASP/LLM items considered.
- `docs/security.md` is the operational guide pointing into this ADR
  per item.
- Threat model files in `docs/threat-models/` cite which controls they
  rely on.
- AI workers (ADR 011) enforce tool metadata (`read_only`,
  `requires_approval`, `tenant_scoped`, `cost_class`) at framework level.

## Open questions

- Bug bounty program when public release lands (M6+)? Likely yes via
  YesWeHack (FR sovereign) or Intigriti.
- Penetration testing cadence: yearly external, internal each major
  release. Budget 5–10K€/year from Pro revenue.
