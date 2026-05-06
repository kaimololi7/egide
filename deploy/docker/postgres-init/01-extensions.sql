-- Egide — PostgreSQL extensions bootstrap.
-- Runs automatically on first container start (docker-entrypoint-initdb.d).

-- pgvector for ontology RAG embeddings (cf. ADR 007).
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm for full-text fallback (hybrid search post-M3).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pg_stat_statements for query performance analysis.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- pgcrypto for hash and crypto helpers (Ed25519 verification stays in app).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schema visible per tenant via search_path is set at app layer.
-- Row-Level Security policies are applied via deploy/scripts/init-db-rls.sql
-- (manual step in dev, automated in Helm chart in prod).
