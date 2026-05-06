# Threat model — API gateway (`apps/api`)

- **Status**: Live
- **Date**: 2026-05-05
- **Reviewer**: solo founder
- **Related ADRs**: 014 (full OWASP Web mapping), 015 (architecture)
- **Component(s)**: `apps/api` (Bun + Hono + tRPC + Better-Auth)

## 1. Assets

| Asset | Sensitivity |
|---|---|
| Authenticated session cookies | critical |
| API tokens (per-tenant) | critical |
| tRPC procedures (entire mutation surface) | high |
| Tenant configuration (AI engine, integrations) | critical |
| OAuth provider credentials | critical |

## 2. Trust boundaries

```
[ User browser / CLI ] ─HTTPS─▶ [ apps/api (Bun + Hono) ]
                                      │
                                      ├─ Better-Auth (sessions, OAuth)
                                      ├─ tRPC routers (5 contexts)
                                      ├─ LLM Router (proxy)
                                      ├─ NATS publisher
                                      └─ pgx (PG client)

External: cloud LLM providers (Anthropic / Mistral / etc.)
Internal: services/* via gRPC mTLS
```

Untrusted zone: HTTP request body, headers, cookies, OAuth callback URLs.
Trusted zone: server memory after authentication + tenant resolution.

## 3. STRIDE threats

### Spoofing
- **Session hijack** via stolen cookie.
  - Mitigation: `Secure`, `HttpOnly`, `SameSite=Lax` cookies ; rotation on
    privilege escalation ; short TTL (4h Pro / 8h Community) ; CSRF
    token on POST.
  - Residual: malware on user machine (out of scope).
- **OAuth callback URL injection**.
  - Mitigation: server-side allow-list of OAuth callback URLs ; state
    parameter validated ; provider whitelist (GitHub, Google, GitLab).

### Tampering
- **API request body tampering** to alter authorization.
  - Mitigation: Zod schemas at every tRPC procedure boundary ; tenant_id
    NEVER trusted from input ; immutable session fields server-side.
- **Idempotency key replay** to alter a previous mutation.
  - Mitigation: idempotent endpoints store `(tenant_id, key, body_hash)`
    in Redis 24h ; same key + different body → 409 ; same key + same
    body → cached response.

### Repudiation
- **User denies sending a mutation**.
  - Mitigation: `audit_logs` row per mutation with `actor_id`, `ip`,
    `user_agent`, `trace_id`. Approvals additionally Ed25519-signed.

### Information disclosure
- **Stack traces in error responses**.
  - Mitigation: production error envelope strips stack ; only `code`,
    `message`, `trace_id`, `documentation_url` returned.
- **Verbose logging includes tokens**.
  - Mitigation: structured logger (`pino`) configured to redact
    `Authorization`, `Cookie`, `*_api_key`, `password` headers/fields.
- **Timing oracle on login**.
  - Mitigation: Better-Auth uses `argon2id` (constant-ish time) ; no
    "user not found" vs "wrong password" distinction in error message.

### Denial of service
- **Login brute force**.
  - Mitigation: 10 attempts/min/IP ; account lock after 5 failed
    attempts (10 min cooldown) ; CAPTCHA after 3 failed attempts (M3+).
- **Large body / slowloris**.
  - Mitigation: Hono request body limit (1 MB default, 10 MB for
    document upload endpoint) ; `Bun.serve` idle timeout 30s.
- **Expensive tRPC procedures called in a loop**.
  - Mitigation: per-tenant rate limit (sliding window in Redis) ; cost
    accounting per procedure.

### Elevation of privilege
- **Viewer attempts admin action**.
  - Mitigation: `requireRole("admin")` middleware on every privileged
    procedure ; e2e tests cover all role/procedure combinations.
- **API token escalation**.
  - Mitigation: API tokens scoped per-tenant + per-role at issue time ;
    cannot be elevated post-issue.

## 4. OWASP Web Top 10 mapping

| ID | Status | Notes |
|---|---|---|
| A01 Broken Access Control | mitigated | `requireRole` + RLS + tenant context middleware |
| A02 Cryptographic Failures | mitigated | argon2id passwords, Ed25519 signatures, TLS 1.3 |
| A03 Injection | mitigated | Drizzle parameterized queries, Zod validation |
| A04 Insecure Design | mitigated | this threat model + ADR 015 patterns |
| A05 Security Misconfiguration | mitigated | distroless image, secure defaults, no debug in prod |
| A06 Vulnerable Components | mitigated | osv-scanner + Dependabot in CI |
| A07 Auth Failures | mitigated | Better-Auth with rate limit + lockout + MFA |
| A08 Data Integrity | mitigated | cosign images, signed bundles |
| A09 Logging Failures | mitigated | audit_logs + structured logging + alerts |
| A10 SSRF | mitigated | URL allow-list for LLM endpoints, no arbitrary fetch |

## 5. Mitigations summary

| # | Mitigation | Where | Verified by |
|---|---|---|---|
| 1 | Secure cookies + CSRF | Better-Auth config | e2e |
| 2 | Zod input validation | every tRPC procedure | unit |
| 3 | Tenant context from session only | `middleware/tenant.ts` | unit + e2e |
| 4 | Idempotency-Key dedup | `shared/idempotent.ts` | unit |
| 5 | Rate limit per IP / tenant | Hono middleware | integration |
| 6 | Audit log on mutations | `shared/audit.ts` decorator | unit |
| 7 | Error scrubber in prod | `shared/error.ts` | unit |
| 8 | URL allow-list for outbound | `packages/llm-router` | unit |

## 6. Accepted residual risks

- **TLS termination at edge proxy** (Caddy / Traefik / cloud LB):
  trust the proxy chain in production. Self-host customers configure
  their own.
- **Insider threat** (malicious tenant admin): out of scope for app
  layer ; covered by audit log.

## 7. Open questions

- Should we expose a public REST adapter from M3 with OpenAPI spec, or
  defer to M5? OpenAPI helps the technical persona ; modest extra
  surface to lock down.
- Add WAF (ModSecurity, Coraza) at the proxy layer? Optional ; nice for
  Enterprise self-host.
