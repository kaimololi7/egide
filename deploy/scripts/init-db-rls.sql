-- Egide — Row-Level Security bootstrap pointer.
--
-- The actual RLS policies now live as a versioned migration alongside the
-- schema:
--
--   packages/db/drizzle/0003_rls.sql           (apply)
--   packages/db/drizzle/0003_rls_down.sql      (rollback)
--
-- This file is kept for backwards compatibility with `deploy/docker/compose.yaml`
-- which mounts deploy/scripts at /docker-entrypoint-initdb.d/. It applies the
-- same migration in dev environments.

\i /docker-entrypoint-initdb.d/0003_rls.sql
