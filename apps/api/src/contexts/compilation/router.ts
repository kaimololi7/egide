/**
 * Compilation bounded context (cf. ADR 015).
 * Owns TAI Intent IR, generators, artifacts, tests.
 *
 * Proxies to services/compiler on COMPILER_URL (default :8003).
 * Status: M4-M5 — compile, compileTest, listIntents implemented.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc.js";

// ── Assertion schema (mirrors domain.RequiredStateAssertion) ──────────────────

const assertionSchema = z.object({
  path: z.string().min(1),
  op: z.enum(["==", "!=", "<", "<=", ">", ">=", "in", "not_in", "regex_match"]),
  value: z.unknown(),
});

// ── Selector schema ───────────────────────────────────────────────────────────

const selectorSchema = z.object({
  kinds: z.array(z.string()).default([]),
  scope: z.string().optional(),
});

// ── Intent schema — inline or by ID ──────────────────────────────────────────

const intentSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  selector: selectorSchema.optional(),
  required_state: z.array(assertionSchema).optional(),
  severity: z.enum(["error", "warning", "info"]).optional(),
  target_hints: z
    .object({
      rego: z.object({ package: z.string(), decision: z.string() }).optional(),
    })
    .optional(),
});

// ── Artifact output schema ────────────────────────────────────────────────────

const artifactSchema = z.object({
  intent_id: z.string(),
  target: z.string(),
  content: z.string(),
  content_hash: z.string(),
  tests_passed: z.number().int(),
  tests_total: z.number().int(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function compilerFetch<T>(
  compilerUrl: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(`${compilerUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `compiler ${res.status}: ${text}`,
    });
  }
  return res.json() as Promise<T>;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const compilationRouter = router({
  // GET /v1/intents — list built-in controls
  listIntents: protectedProcedure.query(async ({ ctx }) => {
    const url = ctx.env.COMPILER_URL;
    ctx.logger.debug({ url }, "compilation.listIntents");

    const res = await compilerFetch<{ intents: unknown[]; total: number }>(
      url,
      "/v1/intents",
      { method: "GET" },
    );
    return res;
  }),

  // POST /v1/compile — compile an intent to an artifact
  compile: protectedProcedure
    .input(
      z.object({
        intent: intentSchema,
        target: z.string().default("rego"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const url = ctx.env.COMPILER_URL;
      ctx.logger.info({ intentId: input.intent.id, target: input.target }, "compilation.compile");

      const artifact = await compilerFetch<z.infer<typeof artifactSchema>>(
        url,
        "/v1/compile",
        { method: "POST", body: JSON.stringify(input) },
      );
      return artifactSchema.parse(artifact);
    }),

  // POST /v1/compile/test — compile + run fixtures
  compileTest: protectedProcedure
    .input(
      z.object({
        intent: intentSchema,
        target: z.string().default("rego"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const url = ctx.env.COMPILER_URL;
      ctx.logger.info({ intentId: input.intent.id }, "compilation.compileTest");

      const resp = await compilerFetch<{
        artifact: z.infer<typeof artifactSchema>;
        results: Array<{ name: string; passed: boolean; expect: string; got: string; message?: string }>;
        passed: boolean;
      }>(url, "/v1/compile/test", { method: "POST", body: JSON.stringify(input) });

      return resp;
    }),
});

