/**
 * Pyramid bounded context (cf. ADR 015).
 * Owns pyramid graph, versions, mutations, coherence.
 *
 * Status: M3 — create, validate, persist, list, get implemented.
 * Validator proxy calls services/validator on port 8002.
 */

import { db, schema } from "@egide/db";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router, serviceProcedure } from "../../trpc.js";

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
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          status: z
            .enum(["draft", "review", "published", "deprecated"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const limit = input?.limit ?? 50;
      ctx.logger.debug({ limit, status: input?.status }, "pyramid.list");

      const conditions = [eq(schema.pyramids.tenantId, ctx.tenantId)];
      if (input?.status) {
        conditions.push(eq(schema.pyramids.status, input.status));
      }

      const rows = await db
        .select({
          id: schema.pyramids.id,
          tenantId: schema.pyramids.tenantId,
          slug: schema.pyramids.slug,
          title: schema.pyramids.title,
          status: schema.pyramids.status,
          targetFrameworks: schema.pyramids.targetFrameworks,
          createdAt: schema.pyramids.createdAt,
          updatedAt: schema.pyramids.updatedAt,
        })
        .from(schema.pyramids)
        .where(and(...conditions))
        .orderBy(desc(schema.pyramids.updatedAt))
        .limit(limit);

      return { pyramids: rows, total: rows.length };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      ctx.logger.debug({ id: input.id }, "pyramid.get");

      const [pyramid] = await db
        .select()
        .from(schema.pyramids)
        .where(
          and(
            eq(schema.pyramids.id, input.id),
            eq(schema.pyramids.tenantId, ctx.tenantId),
          ),
        );
      if (!pyramid) throw new TRPCError({ code: "NOT_FOUND" });

      const versions = await db
        .select({
          id: schema.pyramidVersions.id,
          version: schema.pyramidVersions.version,
          contentHash: schema.pyramidVersions.contentHash,
          createdAt: schema.pyramidVersions.createdAt,
        })
        .from(schema.pyramidVersions)
        .where(eq(schema.pyramidVersions.pyramidId, input.id))
        .orderBy(desc(schema.pyramidVersions.createdAt))
        .limit(20);

      return { pyramid, versions };
    }),

  /**
   * Persist a pyramid — called by `agents/orchestrator` _phase_storing
   * after validation passes. Creates the pyramid row (if first version)
   * and a new pyramid_versions row carrying the graph snapshot.
   *
   * Idempotency: if a version with the same contentHash already exists,
   * returns it (no duplicate insert).
   *
   * Auth: requires a service-account bearer token with scope
   * "pyramid:persist" + X-Egide-Tenant-Id header (cf. middleware/tenant.ts).
   * The orchestrator calls this with EGIDE_ORCHESTRATOR_TOKEN.
   */
  persist: serviceProcedure("pyramid:persist")
    .input(
      z.object({
        pyramidId: z.string().uuid(),
        title: z.string().min(1).max(200),
        slug: z.string().min(1).max(120),
        targetFrameworks: z.array(z.string()).min(1),
        graphSnapshot: z.unknown(),
        status: z
          .enum(["draft", "review", "published"])
          .default("draft"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId || !ctx.session) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const snapshot = JSON.stringify(input.graphSnapshot);
      const contentHash = `sha256:${createHash("sha256").update(snapshot).digest("hex")}`;

      ctx.logger.info(
        { pyramidId: input.pyramidId, contentHash },
        "pyramid.persist",
      );

      // Idempotency: existing version with same hash → return it
      const [existingVersion] = await db
        .select()
        .from(schema.pyramidVersions)
        .where(
          and(
            eq(schema.pyramidVersions.pyramidId, input.pyramidId),
            eq(schema.pyramidVersions.contentHash, contentHash),
          ),
        );
      if (existingVersion) {
        return {
          pyramidId: input.pyramidId,
          versionId: existingVersion.id,
          contentHash,
          deduped: true,
        };
      }

      // Upsert pyramid row
      const [existingPyramid] = await db
        .select()
        .from(schema.pyramids)
        .where(
          and(
            eq(schema.pyramids.id, input.pyramidId),
            eq(schema.pyramids.tenantId, ctx.tenantId),
          ),
        );
      if (!existingPyramid) {
        await db.insert(schema.pyramids).values({
          id: input.pyramidId,
          tenantId: ctx.tenantId,
          slug: input.slug,
          title: input.title,
          status: input.status,
          targetFrameworks: input.targetFrameworks,
        });
      } else {
        await db
          .update(schema.pyramids)
          .set({
            title: input.title,
            status: input.status,
            targetFrameworks: input.targetFrameworks,
            updatedAt: new Date(),
          })
          .where(eq(schema.pyramids.id, input.pyramidId));
      }

      // Compute next version label (v1, v2, …)
      const existingVersions = await db
        .select({ id: schema.pyramidVersions.id })
        .from(schema.pyramidVersions)
        .where(eq(schema.pyramidVersions.pyramidId, input.pyramidId));
      const nextVersion = `v${existingVersions.length + 1}`;

      // For service-account writes, use the system user UUID so the
      // FK to users(id) holds. Real user sessions use their own UUID.
      const actorId = ctx.session.service
        ? ctx.env.EGIDE_SYSTEM_USER_ID
        : ctx.session.userId;

      const [version] = await db
        .insert(schema.pyramidVersions)
        .values({
          pyramidId: input.pyramidId,
          version: nextVersion,
          graphSnapshot: input.graphSnapshot,
          contentHash,
          createdBy: actorId,
        })
        .returning();

      // Update current_version_id pointer
      if (version) {
        await db
          .update(schema.pyramids)
          .set({ currentVersionId: version.id })
          .where(eq(schema.pyramids.id, input.pyramidId));
      }

      // Audit log
      await db.insert(schema.auditLogs).values({
        tenantId: ctx.tenantId,
        pyramidId: input.pyramidId,
        actorId,
        action: "pyramid.persist",
        payload: {
          versionId: version?.id,
          contentHash,
          version: nextVersion,
          actorLabel: ctx.session.service ? ctx.session.userId : undefined,
        },
      });

      return {
        pyramidId: input.pyramidId,
        versionId: version?.id,
        contentHash,
        version: nextVersion,
        deduped: false,
      };
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
