/**
 * Environment validation — fail-fast at boot.
 * Cf. ADR 015 (12-factor).
 */

import { z } from "zod";

const envSchema = z.object({
  // Edition + AI mode
  EGIDE_EDITION: z.enum(["community", "professional", "enterprise"]).default("community"),
  EGIDE_AI_MODE: z.enum(["template_only", "byok", "local", "hybrid"]).default("template_only"),
  EGIDE_PRIVACY_MODE: z.enum(["standard", "strict"]).default("standard"),

  // Persistence
  POSTGRES_URL: z.string().url(),
  CLICKHOUSE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),

  // NATS
  NATS_URL: z.string().default("nats://localhost:4222"),

  // S3 (MinIO in dev, Scaleway/OVH in prod)
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("eu-west-1"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default("egide-evidence"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  // Auth (Better-Auth)
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be ≥32 chars"),
  BETTER_AUTH_URL: z.string().url(),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("127.0.0.1"),

  // Observability
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("egide-api"),

  // Optional LLM keys (per tenant config in DB takes precedence)
  ANTHROPIC_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  SCALEWAY_AI_KEY: z.string().optional(),
  OVH_AI_KEY: z.string().optional(),
  LLM_LOCAL_URL: z.string().url().default("http://localhost:11434"),
  LLM_LOCAL_MODEL: z.string().default("mistral:7b-instruct"),

  // Downstream services
  VALIDATOR_URL: z.string().url().default("http://localhost:8002"),
  EXTRACTOR_URL: z.string().url().default("http://localhost:8001"),
  COMPILER_URL: z.string().url().default("http://localhost:8003"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("✗ Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}
