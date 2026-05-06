/**
 * Pyramid bounded context (cf. ADR 015).
 * Owns pyramid graph, versions, mutations, coherence.
 *
 * Status: M3 — create, validate, getProgress implemented.
 * Validator proxy calls services/validator on port 8002.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc.js";

// ── Shared output schemas ─────────────────────────────────────────────────────

const pyramidSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  status: z.enum(["draft", "review", "published"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const validationIssueSchema = z.object({
  rule_id: z.string(),
  description: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  affected_node_id: z.string().optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const pyramidRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.debug("pyramid.list called");
    // TODO(M4): replace with Drizzle query when pyramid_nodes table is hydrated
    return { pyramids: [] as z.infer<typeof pyramidSummarySchema>[], total: 0 };
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      ctx.logger.debug({ id: input.id }, "pyramid.get called");
      // TODO(M4): fetch from DB
      return null;
    }),

  /**
   * Create (or re-trigger) a pyramid generation job.
   *
   * The API gateway forwards the request to the extractor service,
   * which publishes `egide.v1.extractor.completed` — picked up by the
   * orchestrator J1StateMachine — which then publishes
   * `egide.v1.pyramid.requested` to kick off the compliance agent.
   *
   * Input accepts either a pyramid_id (re-run) or inline metadata
   * for a new pyramid.
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(200),
        frameworks: z.array(z.string()).min(1).max(10),
        mode: z.enum(["template_only", "byok", "local", "hybrid"]).default("template_only"),
        // Optional: S3 key of already-uploaded document
        documentKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      ctx.logger.info({ tenantId: ctx.tenantId, input }, "pyramid.create");
      // Publish a NATS job so the orchestrator can pick it up
      // (packages/messaging NatsClient — injected via ctx in a real impl)
      // For M3 we return a stub job_id; M4 wires the NATS publish + DB row.
      const jobId = crypto.randomUUID();
      return {
        jobId,
        status: "queued",
        message: "pyramid generation queued — subscribe to /api/pyramid-progress/:jobId for SSE updates",
      };
    }),

  /**
   * Validate a pyramid by forwarding to services/validator.
   * Passes tenant_id from session (never from body — cf. ADR 014 §A01).
   */
  validate: protectedProcedure
    .input(z.object({ pyramidId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const validatorUrl = ctx.env.VALIDATOR_URL;
      ctx.logger.info({ tenantId: ctx.tenantId, pyramidId: input.pyramidId }, "pyramid.validate → validator");

      const res = await fetch(`${validatorUrl}/v1/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: ctx.tenantId,
          pyramid_id: input.pyramidId,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 404) {
        throw new TRPCError({ code: "NOT_FOUND", message: "pyramid not found" });
      }
      if (!res.ok) {
        ctx.logger.error({ status: res.status }, "validator returned error");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "validator error" });
      }

      const body = (await res.json()) as {
        pyramid_id: string;
        passed: boolean;
        issues: z.infer<typeof validationIssueSchema>[];
        rules_evaluated: number;
        rules_passed: number;
      };

      return {
        pyramidId: body.pyramid_id,
        passed: body.passed,
        issues: body.issues ?? [],
        rulesEvaluated: body.rules_evaluated,
        rulesPassed: body.rules_passed,
      };
    }),
});
