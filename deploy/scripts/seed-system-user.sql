-- Egide — seed the system user used by service-account writes.
--
-- Run once after migrations. The orchestrator's service-account auth
-- writes pyramid_versions / audit_logs with `created_by = <system-user-id>`
-- (cf. apps/api/src/env.ts EGIDE_SYSTEM_USER_ID, default below).
--
-- The user is associated with a placeholder system tenant for
-- referential integrity. Operations actually write to the real tenant
-- via tenant_id columns ; this row is solely an FK target.

INSERT INTO tenants (id, name, slug, edition)
VALUES (
    '00000000-0000-0000-0000-00000000aaaa',
    'Egide System',
    'egide-system',
    'community'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, tenant_id, email, full_name, role)
VALUES (
    '00000000-0000-0000-0000-00000000beef',
    '00000000-0000-0000-0000-00000000aaaa',
    'system@egide.internal',
    'Egide System Service',
    'admin'
)
ON CONFLICT (tenant_id, email) DO NOTHING;
