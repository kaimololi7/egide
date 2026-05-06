-- Egide — Row-Level Security policies for multi-tenant isolation.
-- Migration 0003. Generated 2026-05-15.
--
-- Cf. ADR 014 §A01 (broken access control) + threat-models/multi-tenant-isolation.md.
--
-- Strategy: every tenant-scoped table enforces RLS via the per-session GUC
-- `egide.current_tenant_id`. The application sets it at the start of every
-- request via `SET LOCAL egide.current_tenant_id = '<uuid>';` (cf.
-- apps/api/src/middleware/tenant.ts).
--
-- Service roles:
--   - egide_app   : everyday application user, RLS-enforced
--   - egide_admin : migration + RLS bypass (used only by Drizzle CLI)
--
-- IMPORTANT: ALTER TABLE … FORCE ROW LEVEL SECURITY also restricts the
-- table owner. Migration scripts must run as `egide_admin` (BYPASSRLS).

-- ── Helper: get current tenant from session GUC ────────────────────────────
CREATE OR REPLACE FUNCTION egide_current_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('egide.current_tenant_id', true), '')::uuid;
$$;

-- ── Roles (idempotent) ──────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'egide_app') THEN
        CREATE ROLE egide_app NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'egide_admin') THEN
        CREATE ROLE egide_admin NOLOGIN BYPASSRLS;
    END IF;
END$$;

-- ── Generic enable-and-policy macro ─────────────────────────────────────────
-- For brevity below, we apply the same pattern to every tenant-scoped table:
--   1. ENABLE + FORCE row level security
--   2. Tenant-isolation policy (read/write where tenant_id = current setting)
--   3. Admin BYPASSRLS role keeps full access

-- tenants ─ per-row read = own tenant ; admin manages
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_isolation ON tenants;
CREATE POLICY tenants_isolation ON tenants
    USING (id = egide_current_tenant());

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_isolation ON users;
CREATE POLICY users_isolation ON users
    USING (tenant_id = egide_current_tenant());

-- licenses
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS licenses_isolation ON licenses;
CREATE POLICY licenses_isolation ON licenses
    USING (tenant_id = egide_current_tenant());

-- pyramids
ALTER TABLE pyramids ENABLE ROW LEVEL SECURITY;
ALTER TABLE pyramids FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pyramids_isolation ON pyramids;
CREATE POLICY pyramids_isolation ON pyramids
    USING (tenant_id = egide_current_tenant());

-- pyramid_versions — tenant_id reachable via pyramids join
ALTER TABLE pyramid_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pyramid_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pyramid_versions_isolation ON pyramid_versions;
CREATE POLICY pyramid_versions_isolation ON pyramid_versions
    USING (
        pyramid_id IN (SELECT id FROM pyramids WHERE tenant_id = egide_current_tenant())
    );

-- mutations — same pattern
ALTER TABLE mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mutations_isolation ON mutations;
CREATE POLICY mutations_isolation ON mutations
    USING (
        pyramid_id IN (SELECT id FROM pyramids WHERE tenant_id = egide_current_tenant())
    );

-- directives
ALTER TABLE directives ENABLE ROW LEVEL SECURITY;
ALTER TABLE directives FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS directives_isolation ON directives;
CREATE POLICY directives_isolation ON directives
    USING (tenant_id = egide_current_tenant());

-- intents
ALTER TABLE intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE intents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intents_isolation ON intents;
CREATE POLICY intents_isolation ON intents
    USING (tenant_id = egide_current_tenant());

-- compiled_artifacts
ALTER TABLE compiled_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE compiled_artifacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compiled_artifacts_isolation ON compiled_artifacts;
CREATE POLICY compiled_artifacts_isolation ON compiled_artifacts
    USING (tenant_id = egide_current_tenant());

-- llm_calls
ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_calls FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS llm_calls_isolation ON llm_calls;
CREATE POLICY llm_calls_isolation ON llm_calls
    USING (tenant_id = egide_current_tenant());

-- evidence_blobs
ALTER TABLE evidence_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_blobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evidence_blobs_isolation ON evidence_blobs;
CREATE POLICY evidence_blobs_isolation ON evidence_blobs
    USING (tenant_id = egide_current_tenant());

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs;
CREATE POLICY audit_logs_isolation ON audit_logs
    USING (tenant_id = egide_current_tenant());

-- integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integrations_isolation ON integrations;
CREATE POLICY integrations_isolation ON integrations
    USING (tenant_id = egide_current_tenant());

-- kpi_actuals — tenant via pyramids
ALTER TABLE kpi_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_actuals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kpi_actuals_isolation ON kpi_actuals;
CREATE POLICY kpi_actuals_isolation ON kpi_actuals
    USING (
        pyramid_id IN (SELECT id FROM pyramids WHERE tenant_id = egide_current_tenant())
    );

-- approval_requests
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS approval_requests_isolation ON approval_requests;
CREATE POLICY approval_requests_isolation ON approval_requests
    USING (tenant_id = egide_current_tenant());

-- ontology_chunks — global RAG corpus, not tenant-scoped (shared knowledge)
-- NOT enabling RLS here. If per-tenant private corpora are added later,
-- introduce a tenant_id column + policy.

-- Better-Auth tables (account/session/verification/rate_limit) are NOT
-- RLS-enforced because they predate the tenant context. The Better-Auth
-- handler uses egide_admin role.

-- ── Grants for application role ────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO egide_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO egide_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO egide_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO egide_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO egide_app;
