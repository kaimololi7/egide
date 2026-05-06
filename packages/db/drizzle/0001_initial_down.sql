-- Egide — rollback migration for 0001_initial.sql
-- Run this to tear down the initial schema cleanly.
-- Order matters: child tables before parents.

DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS ontology_chunks;
DROP TABLE IF EXISTS kpi_actuals;
DROP TABLE IF EXISTS integrations;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS evidence_blobs;
DROP TABLE IF EXISTS llm_calls;
DROP TABLE IF EXISTS compiled_artifacts;
DROP TABLE IF EXISTS intents;
DROP TABLE IF EXISTS directives;
DROP TABLE IF EXISTS mutations;
DROP TABLE IF EXISTS pyramid_versions;
DROP TABLE IF EXISTS pyramids;
DROP TABLE IF EXISTS licenses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenants;

DROP EXTENSION IF EXISTS "vector";
DROP EXTENSION IF EXISTS "uuid-ossp";
