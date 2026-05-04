/**
 * Egide — Drizzle schema for the operational layer.
 *
 * Postgres holds: tenants, users, pyramids (with event-sourced versioning),
 * licenses, LLM call audit, evidence blobs, signed directives, TAI Intents,
 * compiled artifacts, integrations, and KPI actuals.
 *
 * The audit trail (high-volume telemetry) lives in ClickHouse — see
 * `services/datalake`.
 *
 * Tenant isolation: every business table includes `tenant_id`; queries must
 * filter by it. Postgres RLS is the second layer of defense in production.
 */

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────────────────────────────────
// Tenants and users
// ──────────────────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  edition: text("edition", {
    enum: ["community", "professional", "enterprise"],
  })
    .notNull()
    .default("community"),
  locale: text("locale", { enum: ["fr", "en"] })
    .notNull()
    .default("fr"),
  itsmType: text("itsm_type"),
  /** AI engine mode: template_only, byok, local, hybrid (see ADR 004). */
  aiMode: text("ai_mode", {
    enum: ["template_only", "byok", "local", "hybrid"],
  })
    .notNull()
    .default("template_only"),
  /** Encrypted at rest with KMS or local key. */
  aiConfigEncrypted: text("ai_config_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name"),
    role: text("role", {
      enum: ["admin", "process_owner", "auditor", "operator", "viewer"],
    })
      .notNull()
      .default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailTenantUnique: uniqueIndex("users_tenant_email_unique").on(t.tenantId, t.email),
  }),
);

// ──────────────────────────────────────────────────────────────────────────
// Licensing — gates Professional and Enterprise features (see ADR 002)
// ──────────────────────────────────────────────────────────────────────────

export const licenses = pgTable("licenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  edition: text("edition", { enum: ["professional", "enterprise"] }).notNull(),
  /** Ed25519 signed license payload, verified at runtime. */
  signedKey: text("signed_key").notNull(),
  /** Decoded payload for fast feature-flag lookup. */
  decodedClaims: jsonb("decoded_claims").$type<{
    features: string[];
    maxTenants?: number;
    maxAgents?: number;
    expiresAt: string;
  }>(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ──────────────────────────────────────────────────────────────────────────
// Pyramid versioning (event-sourced)
// ──────────────────────────────────────────────────────────────────────────

export const pyramids = pgTable("pyramids", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  status: text("status", {
    enum: ["draft", "review", "published", "deprecated"],
  })
    .notNull()
    .default("draft"),
  targetFrameworks: jsonb("target_frameworks").$type<string[]>().notNull(),
  publishIntent: boolean("publish_intent").notNull().default(false),
  currentVersionId: uuid("current_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pyramidVersions = pgTable(
  "pyramid_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pyramidId: uuid("pyramid_id")
      .notNull()
      .references(() => pyramids.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    parentVersionId: uuid("parent_version_id"),
    /** Whole pyramid serialized as JSON. */
    graphSnapshot: jsonb("graph_snapshot").notNull(),
    /** Deterministic hash of graphSnapshot for evidence integrity. */
    contentHash: text("content_hash").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    versionPerPyramidUnique: uniqueIndex("pyramid_versions_pyramid_version_unique").on(
      t.pyramidId,
      t.version,
    ),
  }),
);

export const mutations = pgTable("mutations", {
  id: uuid("id").defaultRandom().primaryKey(),
  pyramidId: uuid("pyramid_id")
    .notNull()
    .references(() => pyramids.id, { onDelete: "cascade" }),
  versionFromId: uuid("version_from_id"),
  versionToId: uuid("version_to_id"),
  mutationType: text("mutation_type").notNull(),
  payload: jsonb("payload").notNull(),
  validationReport: jsonb("validation_report"),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ──────────────────────────────────────────────────────────────────────────
// Strategic directives (J6 — boardroom signature → cascade)
// ──────────────────────────────────────────────────────────────────────────

export const directives = pgTable("directives", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status", {
    enum: ["draft", "review", "signed", "superseded"],
  })
    .notNull()
    .default("draft"),
  /** Engagements, principles, scope, exceptions, governance, measurable objectives. */
  content: jsonb("content").notNull(),
  signedByName: text("signed_by_name"),
  signedByTitle: text("signed_by_title"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  /** Hash of the canonicalized signed content; bound to evidence chain. */
  signatureHash: text("signature_hash"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ──────────────────────────────────────────────────────────────────────────
// TAI Intents and compiled artifacts (see ADR 005, docs/specs/intent-ir.md)
// ──────────────────────────────────────────────────────────────────────────

export const intents = pgTable(
  "intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    pyramidArtifactId: text("pyramid_artifact_id").notNull(),
    /** Stable user-facing ID, e.g. "intent_db_backup_required". */
    intentRef: text("intent_ref").notNull(),
    version: text("version").notNull(),
    /** Full TAI JSON document. Conforms to docs/specs/intent-ir.md. */
    tai: jsonb("tai").notNull(),
    contentHash: text("content_hash").notNull(),
    severity: text("severity", { enum: ["error", "warn", "info"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    intentRefUnique: uniqueIndex("intents_tenant_ref_version_unique").on(
      t.tenantId,
      t.intentRef,
      t.version,
    ),
  }),
);

export const compiledArtifacts = pgTable(
  "compiled_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    intentId: uuid("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    target: text("target", {
      enum: [
        "rego",
        "kyverno",
        "ansible",
        "cis",
        "aws_config",
        "azure_policy",
        "scaleway_iam",
        "gcp_org_policy",
        "falco",
        "terraform_sentinel",
      ],
    }).notNull(),
    format: text("format").notNull(),
    /** Generated artifact body. Large but bounded; consider S3 if > 1 MB. */
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    /** Ed25519 signature (Enterprise only). */
    signature: text("signature"),
    testReport: jsonb("test_report"),
    compilerVersion: text("compiler_version").notNull(),
    status: text("status", {
      enum: ["fresh", "stale", "failed"],
    })
      .notNull()
      .default("fresh"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    intentTargetIdx: index("compiled_artifacts_intent_target_idx").on(t.intentId, t.target),
  }),
);

// ──────────────────────────────────────────────────────────────────────────
// LLM call audit — every provider call is logged (see ADR 004)
// ──────────────────────────────────────────────────────────────────────────

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    provider: text("provider", {
      enum: [
        "anthropic",
        "mistral",
        "scaleway",
        "ovh",
        "openai_compat",
        "ollama",
        "vllm",
        "lmstudio",
      ],
    }).notNull(),
    model: text("model").notNull(),
    /** Task type drives provider routing per ADR 004. */
    taskType: text("task_type", {
      enum: ["extraction", "generation", "classification", "judge", "other"],
    }).notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    /** Cost in micro-USD (1e-6 USD) to keep precision without floats. */
    estCostMicroUsd: bigint("est_cost_micro_usd", { mode: "number" }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    success: boolean("success").notNull(),
    errorCode: text("error_code"),
    /** Optional reference to whatever artifact this call contributed to. */
    contextRef: text("context_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantTimeIdx: index("llm_calls_tenant_time_idx").on(t.tenantId, t.createdAt),
  }),
);

// ──────────────────────────────────────────────────────────────────────────
// Evidence blobs — signed exports (OSCAL SSPs, signed PDFs, hash-chained)
// ──────────────────────────────────────────────────────────────────────────

export const evidenceBlobs = pgTable("evidence_blobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  pyramidId: uuid("pyramid_id").references(() => pyramids.id, { onDelete: "set null" }),
  kind: text("kind", {
    enum: ["oscal_ssp", "audit_export", "directive_signed_pdf", "policy_pdf", "other"],
  }).notNull(),
  /** S3 / MinIO key for the actual blob. */
  storageKey: text("storage_key").notNull(),
  contentHash: text("content_hash").notNull(),
  /** Chains to previous blob's hash for tamper detection. */
  prevHash: text("prev_hash"),
  signature: text("signature"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ──────────────────────────────────────────────────────────────────────────
// Audit logs (low-volume security events; high-volume telemetry → ClickHouse)
// ──────────────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    pyramidId: uuid("pyramid_id"),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    payload: jsonb("payload"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantTimeIdx: index("audit_logs_tenant_time_idx").on(t.tenantId, t.createdAt),
  }),
);

// ──────────────────────────────────────────────────────────────────────────
// Integrations and KPI actuals
// ──────────────────────────────────────────────────────────────────────────

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "servicenow",
      "jira_sm",
      "glpi",
      "freshservice",
      "zendesk",
      "proxmox",
      "ansible_inventory",
      "aws",
      "azure",
      "scaleway",
      "ovh",
      "k8s",
    ],
  }).notNull(),
  /** Encrypted at rest. Includes API tokens, URLs, mTLS material. */
  configEncrypted: text("config_encrypted").notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kpiActuals = pgTable("kpi_actuals", {
  id: uuid("id").defaultRandom().primaryKey(),
  pyramidId: uuid("pyramid_id")
    .notNull()
    .references(() => pyramids.id, { onDelete: "cascade" }),
  kpiId: text("kpi_id").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  value: integer("value"),
  unit: text("unit"),
  source: text("source").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
