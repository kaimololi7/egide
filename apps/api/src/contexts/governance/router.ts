/**
 * Governance bounded context (cf. ADR 015 + ADR 010).
 * Owns directives, approvals, RBAC, license check.
 *
 * The actual approval_requests schema uses a single-approver model
 * (entityType + entityId + approverRole + approvedBy). Multi-approver
 * extension is deferred to M11+ Enterprise.
 */

import { db, schema } from "@egide/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../../trpc.js";

const entityTypeEnum = z.enum([
  "pyramid_version",
  "directive",
  "compiled_artifact",
  "mutation",
]);
const approverRoleEnum = z.enum(["admin", "process_owner", "auditor"]);
const decisionEnum = z.enum(["approve", "reject"]);

export const governanceRouter = router({
  /**
   * List approval requests for the tenant. Filterable by status / entity type.
   */
  listApprovals: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(["pending", "approved", "rejected", "cancelled"])
            .optional(),
          entityType: entityTypeEnum.optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const limit = input?.limit ?? 50;

      const conditions = [eq(schema.approvalRequests.tenantId, ctx.tenantId)];
      if (input?.status) {
        conditions.push(eq(schema.approvalRequests.status, input.status));
      }
      if (input?.entityType) {
        conditions.push(eq(schema.approvalRequests.entityType, input.entityType));
      }

      const requests = await db
        .select()
        .from(schema.approvalRequests)
        .where(and(...conditions))
        .orderBy(desc(schema.approvalRequests.createdAt))
        .limit(limit);

      return { approvals: requests, total: requests.length };
    }),

  /** Single approval detail. */
  getApproval: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const [request] = await db
        .select()
        .from(schema.approvalRequests)
        .where(
          and(
            eq(schema.approvalRequests.id, input.id),
            eq(schema.approvalRequests.tenantId, ctx.tenantId),
          ),
        );
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { request };
    }),

  /**
   * Create a new approval request. Typically called by Ansible runner (J9)
   * or directive signature wizard (J6).
   */
  requestApproval: protectedProcedure
    .input(
      z.object({
        entityType: entityTypeEnum,
        entityId: z.string().uuid(),
        approverRole: approverRoleEnum,
        expiresInHours: z.number().int().min(1).max(720).default(24),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId || !ctx.session) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const expiresAt = new Date(Date.now() + input.expiresInHours * 3600_000);
      const [created] = await db
        .insert(schema.approvalRequests)
        .values({
          tenantId: ctx.tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          requestedBy: ctx.session.userId,
          approverRole: input.approverRole,
          status: "pending",
          expiresAt,
        })
        .returning();

      ctx.logger.info(
        { approvalId: created?.id, entityType: input.entityType },
        "governance.requestApproval — TODO publish egide.v1.governance.actions",
      );

      return { id: created?.id, status: "pending" as const, expiresAt };
    }),

  /**
   * Resolve an approval (approve or reject). Caller must have a role
   * that matches the request's `approverRole`.
   * Real Ed25519 signature verification lands at M3.
   */
  resolveApproval: protectedProcedure
    .input(
      z.object({
        approvalId: z.string().uuid(),
        decision: decisionEnum,
        comment: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId || !ctx.session) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const [request] = await db
        .select()
        .from(schema.approvalRequests)
        .where(
          and(
            eq(schema.approvalRequests.id, input.approvalId),
            eq(schema.approvalRequests.tenantId, ctx.tenantId),
          ),
        );
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.status !== "pending") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `approval already ${request.status}`,
        });
      }
      if (request.expiresAt && request.expiresAt < new Date()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "approval expired",
        });
      }
      if (ctx.session.role !== request.approverRole && ctx.session.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `requires role ${request.approverRole}`,
        });
      }

      const newStatus = input.decision === "approve" ? "approved" : "rejected";
      await db
        .update(schema.approvalRequests)
        .set({
          status: newStatus,
          approvedBy: ctx.session.userId,
          comment: input.comment,
          resolvedAt: new Date(),
        })
        .where(eq(schema.approvalRequests.id, request.id));

      ctx.logger.info(
        { approvalId: request.id, decision: input.decision },
        "governance.resolveApproval",
      );

      return { id: request.id, status: newStatus };
    }),

  /**
   * (Admin) List signed directives. The directive signature wizard (J6)
   * lands at M17+ ; for now this returns the registry shape so the
   * dashboard renders an empty state cleanly.
   */
  listDirectives: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    const directives = await db
      .select()
      .from(schema.directives)
      .where(eq(schema.directives.tenantId, ctx.tenantId))
      .orderBy(desc(schema.directives.createdAt))
      .limit(50);
    return { directives, total: directives.length };
  }),
});
