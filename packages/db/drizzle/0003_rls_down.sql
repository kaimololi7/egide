-- Down migration for 0003_rls.sql.

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'tenants','users','licenses','pyramids','pyramid_versions',
        'mutations','directives','intents','compiled_artifacts','llm_calls',
        'evidence_blobs','audit_logs','integrations','kpi_actuals',
        'approval_requests'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I_isolation ON %I;', tbl, tbl);
    END LOOP;
END$$;

DROP FUNCTION IF EXISTS egide_current_tenant();
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM egide_app;
REVOKE USAGE ON SCHEMA public FROM egide_app;
-- Roles intentionally not dropped (may be referenced elsewhere).
