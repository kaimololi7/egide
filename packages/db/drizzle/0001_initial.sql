-- Egide — initial schema migration
-- Generated: 2026-05-05
-- Down migration: see 0001_initial_down.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── Tenants ────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  slug                TEXT        NOT NULL UNIQUE,
  edition             TEXT        NOT NULL DEFAULT 'community'
                        CHECK (edition IN ('community', 'professional', 'enterprise')),
  locale              TEXT        NOT NULL DEFAULT 'fr'
                        CHECK (locale IN ('fr', 'en')),
  itsm_type           TEXT,
  ai_mode             TEXT        NOT NULL DEFAULT 'template_only'
                        CHECK (ai_mode IN ('template_only', 'byok', 'local', 'hybrid')),
  ai_config_encrypted TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  full_name  TEXT,
  role       TEXT        NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('admin', 'process_owner', 'auditor', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_tenant_email_unique ON users (tenant_id, email);

-- ─── Licenses ────────────────────────────────────────────────────────────────
CREATE TABLE licenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edition         TEXT        NOT NULL
                    CHECK (edition IN ('professional', 'enterprise')),
  signed_key      TEXT        NOT NULL,
  decoded_claims  JSONB,
  valid_from      TIMESTAMPTZ NOT NULL,
  valid_until     TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Pyramids ─────────────────────────────────────────────────────────────────
CREATE TABLE pyramids (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug                TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'review', 'published', 'deprecated')),
  target_frameworks   JSONB       NOT NULL,
  publish_intent      BOOLEAN     NOT NULL DEFAULT FALSE,
  current_version_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pyramid_versions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pyramid_id        UUID        NOT NULL REFERENCES pyramids(id) ON DELETE CASCADE,
  version           TEXT        NOT NULL,
  parent_version_id UUID,
  graph_snapshot    JSONB       NOT NULL,
  content_hash      TEXT        NOT NULL,
  created_by        UUID        NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX pyramid_versions_pyramid_version_unique
  ON pyramid_versions (pyramid_id, version);

CREATE TABLE mutations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pyramid_id          UUID        NOT NULL REFERENCES pyramids(id) ON DELETE CASCADE,
  version_from_id     UUID,
  version_to_id       UUID,
  mutation_type       TEXT        NOT NULL,
  payload             JSONB       NOT NULL,
  validation_report   JSONB,
  actor_id            UUID        NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Directives ───────────────────────────────────────────────────────────────
CREATE TABLE directives (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'review', 'signed', 'superseded')),
  content         JSONB       NOT NULL,
  signed_by_name  TEXT,
  signed_by_title TEXT,
  signed_at       TIMESTAMPTZ,
  signature_hash  TEXT,
  valid_from      TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TAI Intents + compiled artifacts ─────────────────────────────────────────
CREATE TABLE intents (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pyramid_artifact_id  TEXT        NOT NULL,
  intent_ref           TEXT        NOT NULL,
  version              TEXT        NOT NULL,
  tai                  JSONB       NOT NULL,
  content_hash         TEXT        NOT NULL,
  severity             TEXT        NOT NULL
                         CHECK (severity IN ('error', 'warn', 'info')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX intents_tenant_ref_version_unique
  ON intents (tenant_id, intent_ref, version);

CREATE TABLE compiled_artifacts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  intent_id        UUID        NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
  target           TEXT        NOT NULL
                     CHECK (target IN (
                       'rego', 'kyverno', 'ansible', 'cis',
                       'aws_config', 'azure_policy', 'scaleway_iam',
                       'gcp_org_policy', 'falco', 'terraform_sentinel'
                     )),
  format           TEXT        NOT NULL,
  content          TEXT        NOT NULL,
  content_hash     TEXT        NOT NULL,
  signature        TEXT,
  test_report      JSONB,
  compiler_version TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'fresh'
                     CHECK (status IN ('fresh', 'stale', 'failed')),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX compiled_artifacts_intent_target_idx
  ON compiled_artifacts (intent_id, target);

-- ─── LLM call audit ───────────────────────────────────────────────────────────
CREATE TABLE llm_calls (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id             UUID        REFERENCES users(id),
  provider             TEXT        NOT NULL
                         CHECK (provider IN (
                           'anthropic', 'mistral', 'scaleway', 'ovh',
                           'openai_compat', 'ollama', 'vllm', 'lmstudio'
                         )),
  model                TEXT        NOT NULL,
  task_type            TEXT        NOT NULL
                         CHECK (task_type IN (
                           'extraction', 'generation', 'classification', 'judge', 'other'
                         )),
  input_tokens         INTEGER     NOT NULL,
  output_tokens        INTEGER     NOT NULL,
  est_cost_micro_usd   BIGINT      NOT NULL,
  latency_ms           INTEGER     NOT NULL,
  success              BOOLEAN     NOT NULL,
  error_code           TEXT,
  context_ref          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX llm_calls_tenant_time_idx ON llm_calls (tenant_id, created_at);

-- ─── Evidence blobs ────────────────────────────────────────────────────────────
CREATE TABLE evidence_blobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pyramid_id   UUID        REFERENCES pyramids(id) ON DELETE SET NULL,
  kind         TEXT        NOT NULL
                 CHECK (kind IN (
                   'oscal_ssp', 'audit_export', 'directive_signed_pdf',
                   'policy_pdf', 'other'
                 )),
  storage_key  TEXT        NOT NULL,
  content_hash TEXT        NOT NULL,
  prev_hash    TEXT,
  signature    TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit logs ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pyramid_id UUID,
  actor_id   UUID        REFERENCES users(id),
  action     TEXT        NOT NULL,
  payload    JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_tenant_time_idx ON audit_logs (tenant_id, created_at);

-- ─── Integrations ──────────────────────────────────────────────────────────────
CREATE TABLE integrations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type               TEXT        NOT NULL
                       CHECK (type IN (
                         'servicenow', 'jira_sm', 'glpi', 'freshservice', 'zendesk',
                         'proxmox', 'ansible_inventory',
                         'aws', 'azure', 'scaleway', 'ovh', 'k8s'
                       )),
  config_encrypted   TEXT        NOT NULL,
  last_sync_at       TIMESTAMPTZ,
  last_sync_status   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── KPI actuals ───────────────────────────────────────────────────────────────
CREATE TABLE kpi_actuals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pyramid_id   UUID        NOT NULL REFERENCES pyramids(id) ON DELETE CASCADE,
  kpi_id       TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end   TIMESTAMPTZ NOT NULL,
  value        INTEGER,
  unit         TEXT,
  source       TEXT        NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Normative RAG index — ontology chunks with pgvector (ADR 007) ─────────────
CREATE TABLE ontology_chunks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster    TEXT        NOT NULL,
  framework  TEXT        NOT NULL,
  clause     TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  text       TEXT        NOT NULL,
  -- 1536-dim embedding (text-embedding-3-small). NULL until embedded.
  embedding  vector(1536),
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ontology_chunks_cluster_idx
  ON ontology_chunks (cluster);
CREATE INDEX ontology_chunks_framework_clause_idx
  ON ontology_chunks (framework, clause);
-- HNSW index for cosine similarity (cf. ADR 007)
CREATE INDEX ontology_chunks_embedding_hnsw_idx
  ON ontology_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─── Approval requests — governance sign-off workflow (ADR 010) ────────────────
CREATE TABLE approval_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type    TEXT        NOT NULL
                   CHECK (entity_type IN (
                     'pyramid_version', 'directive', 'compiled_artifact', 'mutation'
                   )),
  entity_id      UUID        NOT NULL,
  requested_by   UUID        NOT NULL REFERENCES users(id),
  approver_role  TEXT        NOT NULL
                   CHECK (approver_role IN ('admin', 'process_owner', 'auditor')),
  approved_by    UUID        REFERENCES users(id),
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  comment        TEXT,
  expires_at     TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX approval_requests_entity_idx
  ON approval_requests (entity_type, entity_id);
CREATE INDEX approval_requests_tenant_status_idx
  ON approval_requests (tenant_id, status);
