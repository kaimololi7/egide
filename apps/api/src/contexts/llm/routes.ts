/**
 * /v1/llm/complete — direct Hono route for service-account LLM calls.
 *
 * Why a Hono route and not a tRPC procedure ?
 *   - The orchestrator (Python httpx) talks plain JSON ; tRPC's
 *     superjson envelope adds friction without value here.
 *   - Easier to expose to non-TS workers (Go validator, future agents).
 *
 * Auth: bearer service-account token with scope "llm:complete" + the
 * X-Egide-Tenant-Id header (cf. middleware/tenant.ts).
 *
 * Provider selection: env-driven (no per-tenant config table at MVP).
 *   1. EGIDE_AI_MODE=template_only → 503 (degraded, by design)
 *   2. EGIDE_AI_MODE=local | LLM_LOCAL_URL set with no cloud key → Ollama
 *   3. ANTHROPIC_API_KEY set → Anthropic
 *   4. MISTRAL_API_KEY set → Mistral
 *   5. otherwise → 503
 *
 * Audit: every call (success or failure) writes one row to llm_calls.
 *
 * Cf. ADR 004 (multi-LLM router) + ADR 014 §LLM02/§LLM10 (PII scrub +
 * budget cap — enforced upstream by tenant config in M5).
 */

import { Hono } from "hono";
import { db, schema } from "@egide/db";
import { z } from "zod";
import {
  AnthropicProvider,
  MistralProvider,
  OllamaProvider,
  type CompleteRequest,
  type CompleteResponse,
  type LLMProvider,
} from "@egide/llm-router";
import { authenticateServiceAccount } from "../../middleware/tenant.js";
import type { Env } from "../../env.js";
import type pino from "pino";

const REQUIRED_SCOPE = "llm:complete";

const completeBodySchema = z.object({
  task: z
    .enum(["generation", "extraction", "classification", "judge", "synthesis"])
    .default("generation"),
  system: z.string().max(20_000).default(""),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(50_000),
      }),
    )
    .min(1)
    .max(40),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(8_192).optional(),
  /** Optional reference to whatever artifact this call contributed to. */
  context_ref: z.string().max(200).optional(),
  pyramid_id: z.string().uuid().optional(),
  trace_id: z.string().max(80).optional(),
});

type CompleteBody = z.infer<typeof completeBodySchema>;

function pickProvider(env: Env): { provider: LLMProvider; model: string } | null {
  if (env.EGIDE_AI_MODE === "template_only") return null;

  const preferLocal =
    env.EGIDE_AI_MODE === "local" || env.EGIDE_PRIVACY_MODE === "strict";

  if (preferLocal || (!env.ANTHROPIC_API_KEY && !env.MISTRAL_API_KEY)) {
    return {
      provider: new OllamaProvider({
        baseUrl: env.LLM_LOCAL_URL,
        defaultModel: env.LLM_LOCAL_MODEL,
        timeoutMs: 120_000,
      }),
      model: env.LLM_LOCAL_MODEL,
    };
  }

  if (env.ANTHROPIC_API_KEY) {
    const model = "claude-sonnet-4-6";
    return {
      provider: new AnthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        defaultModel: model,
      }),
      model,
    };
  }

  if (env.MISTRAL_API_KEY) {
    const model = "mistral-large-latest";
    return {
      provider: new MistralProvider({
        apiKey: env.MISTRAL_API_KEY,
        defaultModel: model,
      }),
      model,
    };
  }

  return null;
}

function buildLlmRequest(body: CompleteBody, tenantId: string): CompleteRequest {
  return {
    systemPrompt: body.system,
    messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: body.temperature ?? 0.3,
    maxTokens: body.max_tokens ?? 2_048,
    audit: {
      tenantId,
      pyramidId: body.pyramid_id,
      traceId: body.trace_id,
      workerName: "agents.orchestrator",
      journeyPhase: "j1.draft",
    },
  };
}

async function recordCall(args: {
  tenantId: string;
  provider: string;
  model: string;
  task: CompleteBody["task"];
  inputTokens: number;
  outputTokens: number;
  estCostMicroUsd: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  contextRef?: string;
}): Promise<void> {
  // Map router task type onto schema enum (subset).
  const dbTask =
    args.task === "extraction" ||
    args.task === "generation" ||
    args.task === "classification" ||
    args.task === "judge"
      ? args.task
      : "other";

  await db
    .insert(schema.llmCalls)
    .values({
      tenantId: args.tenantId,
      provider: args.provider as
        | "anthropic"
        | "mistral"
        | "scaleway"
        | "ovh"
        | "openai_compat"
        | "ollama"
        | "vllm"
        | "lmstudio",
      model: args.model,
      taskType: dbTask,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      estCostMicroUsd: args.estCostMicroUsd,
      latencyMs: args.latencyMs,
      success: args.success,
      errorCode: args.errorCode,
      contextRef: args.contextRef,
    });
}

export function llmRoutes(env: Env, logger: pino.Logger): Hono {
  const app = new Hono();

  app.post("/complete", async (c) => {
    const session = authenticateServiceAccount(env, c.req.raw);
    if (!session) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "service-account token required" } },
        401,
      );
    }
    if (!session.scopes?.includes(REQUIRED_SCOPE)) {
      return c.json(
        { error: { code: "FORBIDDEN", message: `scope ${REQUIRED_SCOPE} required` } },
        403,
      );
    }

    let body: CompleteBody;
    try {
      const raw = await c.req.json();
      body = completeBodySchema.parse(raw);
    } catch (err) {
      return c.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "invalid body",
          },
        },
        400,
      );
    }

    const choice = pickProvider(env);
    if (!choice) {
      logger.warn(
        { aiMode: env.EGIDE_AI_MODE, tenantId: session.tenantId },
        "/v1/llm/complete unavailable: no provider configured",
      );
      return c.json(
        {
          error: {
            code: "AI_DISABLED",
            message:
              "no LLM provider available — set EGIDE_AI_MODE + provider key",
          },
        },
        503,
      );
    }

    const { provider, model } = choice;
    const llmReq = buildLlmRequest(body, session.tenantId);
    const t0 = Date.now();

    let resp: CompleteResponse;
    try {
      resp = await provider.complete(llmReq);
    } catch (err) {
      const latencyMs = Date.now() - t0;
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        { err, provider: provider.name, tenantId: session.tenantId, latencyMs },
        "/v1/llm/complete provider failure",
      );
      try {
        await recordCall({
          tenantId: session.tenantId,
          provider: provider.name,
          model,
          task: body.task,
          inputTokens: 0,
          outputTokens: 0,
          estCostMicroUsd: 0,
          latencyMs,
          success: false,
          errorCode: (err as { code?: string }).code ?? "PROVIDER_ERROR",
          contextRef: body.context_ref,
        });
      } catch (auditErr) {
        logger.error({ err: auditErr }, "failed to write llm_calls audit row");
      }
      return c.json(
        { error: { code: "PROVIDER_ERROR", message } },
        502,
      );
    }

    const latencyMs = Date.now() - t0;
    try {
      await recordCall({
        tenantId: session.tenantId,
        provider: provider.name,
        model,
        task: body.task,
        inputTokens: resp.usage.inputTokens,
        outputTokens: resp.usage.outputTokens,
        estCostMicroUsd: resp.estCostMicroUsd,
        latencyMs,
        success: true,
        contextRef: body.context_ref,
      });
    } catch (auditErr) {
      // Audit failure must not break the user response, but it's loud.
      logger.error({ err: auditErr }, "failed to write llm_calls audit row");
    }

    return c.json({
      content: resp.content,
      tool_uses: resp.toolUses,
      usage: {
        input_tokens: resp.usage.inputTokens,
        output_tokens: resp.usage.outputTokens,
      },
      cache_hit: resp.cacheHit,
      est_cost_micro_usd: resp.estCostMicroUsd,
      latency_ms: latencyMs,
      finish_reason: resp.finishReason,
      provider: provider.name,
      model,
    });
  });

  return app;
}
