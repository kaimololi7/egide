# Threat model — Multi-tenant isolation

- **Status**: Live
- **Date**: 2026-05-05
- **Reviewer**: solo founder
- **Related ADRs**: 014 §A01, 015 (5 bounded contexts)
- **Component(s)**: cross-cutting — `apps/api`, `services/*`, `agents/*`,
  `packages/db`

## 1. Assets

| Asset | Sensitivity |
|---|---|
| Tenant pyramid graph (policies, procedures, KPIs) | high |
| Tenant directives + signed approvals | high |
| Tenant audit log + evidence blobs | critical |
| Tenant LLM API keys (BYOK) | critical |
| Tenant collector credentials (Proxmox, AWS, etc.) | critical |
| Tenant ontology overrides | medium |
| Tenant licence key | high |

## 2. Trust boundaries

```
┌──────────────────────────────────────────────┐
│ Tenant A user (browser/CLI)                  │
└──────────────────┬───────────────────────────┘
                   │ HTTPS, session cookie / API token
┌──────────────────▼───────────────────────────┐
│ apps/api (auth + tenant resolution)          │ ← trust boundary
└─┬────────────────┬───────────────┬───────────┘
  │ pgx            │ NATS msg      │ HTTP/gRPC
  │ tenant_id      │ tenant_id     │ tenant_id
  ▼                ▼               ▼
PostgreSQL +    NATS subjects    services/*  ←
RLS policies    (tenant tag)     agents/*       trust zone
(every table)                                   (internal)
```

Untrusted: tenant user input, document content, LLM output.
Trusted: server-side `ctx.tenantId` extracted from authenticated session.

## 3. STRIDE threats

### Spoofing
- **Threat**: User from tenant A impersonates tenant B by tampering with
  client-side state.
  - **Mitigation**: `tenant_id` is **never** read from request body or
    URL parameter ; always taken from server-side authenticated session
    (Better-Auth → `ctx.tenantId`). Repository layer enforces.
  - **Residual**: shared session-cookie host attack (mitigated by
    `SameSite=Lax`, `Secure`, `HttpOnly`).

### Tampering
- **Threat**: Tenant A modifies `tenant_id` query parameter to access
  tenant B's pyramid.
  - **Mitigation**: API rejects any `tenant_id` field in input ;
    repository layer adds `WHERE tenant_id = $session_tenant_id` ; PG
    RLS as defense in depth (`USING tenant_id = current_setting('egide.current_tenant_id')::uuid`).
  - **Residual**: bug allows query without tenant filter → mitigated by
    PG RLS (FORCE ROW LEVEL SECURITY on every tenant-scoped table).

### Repudiation
- **Threat**: Tenant disputes that an action was performed by their user.
  - **Mitigation**: every mutation logged in `audit_logs` with
    `tenant_id`, `actor_id`, `ip`, `user_agent`, `trace_id`. Approvals
    additionally Ed25519-signed (`approval_signatures`).
  - **Residual**: actor with shared credentials → MFA mandatory in Pro+.

### Information disclosure
- **Threat**: Cross-tenant data leak via cache, query mistake, or NATS
  fan-out.
  - **Mitigation**: Redis cache keys prefixed with `tenant:<id>:` ;
    NATS subjects include `tenant.<id>` ; consumer filters by
    `tenant_id` in payload ; embeddings table partitioned by tenant
    (`ontology_chunks.tenant_id`, `WHERE tenant_id = ? OR tenant_id IS NULL`).
  - **Residual**: log lines mixing tenant data → trace_id-only logging
    by default ; payloads logged only at DEBUG level (off in prod).

### Denial of service
- **Threat**: Tenant A's heavy job exhausts shared resources (LLM
  budget, NATS bandwidth, PG connections).
  - **Mitigation**: per-tenant rate limits (cf. ADR 014 §LLM10) ; per-tenant
    budget cap on LLM calls ; PG connection pool fair-shared ; NATS
    subject queues per tenant.
  - **Residual**: noisy-neighbor at infrastructure level (Helm
    requests/limits per pod scale by tenant count).

### Elevation of privilege
- **Threat**: User in tenant A's `viewer` role mutates resources via
  direct API call.
  - **Mitigation**: RBAC checked in tRPC middleware via
    `requireRole()` ; deny-by-default ; e2e tests assert role
    boundaries.
  - **Residual**: zero — RBAC bug = test failure = CI gate.

## 4. LLM-specific (LLM02 + LLM08)

- **LLM02 — Sensitive info disclosure**: PII scrubber pre-prompt for
  cloud providers ; `ai_engine.privacy_mode: strict` blocks all cloud
  calls.
- **LLM08 — Vector weaknesses**: `ontology_chunks` always queried with
  `(tenant_id = ? OR tenant_id IS NULL)` filter ; cross-tenant retrieval
  impossible by construction.

## 5. Mitigations summary

| # | Mitigation | Where | Verified by |
|---|---|---|---|
| 1 | `tenant_id` from session only, never from request | `apps/api/src/middleware/tenant.ts` | unit + e2e |
| 2 | Repository `WHERE tenant_id = $1` enforced | `apps/api/src/contexts/*/repository.ts` | unit |
| 3 | PG RLS `FORCE ROW LEVEL SECURITY` on tenant tables | `deploy/scripts/init-db-rls.sql` | integration |
| 4 | Cache key tenant prefix | `apps/api/src/shared/cache.ts` | unit |
| 5 | NATS subject + payload tenant filter | `packages/messaging` | unit |
| 6 | Per-tenant LLM rate limit + budget | `packages/llm-router` | unit |
| 7 | RBAC deny-by-default | `apps/api/src/middleware/auth.ts` | e2e |

## 6. Accepted residual risks

- **Side-channel timing attacks** to enumerate other tenants' resources
  via response time differences. Accepted ; would require advanced
  attacker (revisit M9+ when paid customers).
- **Compromise of server master DEK wrap key**: catastrophic but
  out-of-scope for app-level mitigation. Mitigated by KMS rotation
  policy (90 days) and key access audit.

## 7. Open questions

- Should we add a "decoy" honeytoken in each tenant's pyramide to
  detect cross-tenant exfiltration attempts? Defer to M11+ Enterprise.
