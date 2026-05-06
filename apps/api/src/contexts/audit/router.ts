/**
 * Audit bounded context (cf. ADR 015 + ADR 014 §A09).
 * Owns evidence blobs, audit logs, OSCAL exports, integrity chain.
 *
 * Procedures:
 *   - listEvents       : timeline of audit_logs
 *   - listEvidence     : signed evidence_blobs with hash chain
 *   - verifyChain      : check that prev_hash links are coherent
 *   - exportOSCAL      : (Pro+) export pyramid as OSCAL SSP — stub at MVP
 */

import { db, schema } from "@egide/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../../trpc.js";

export const auditRouter = router({
  /**
   * Timeline of audit events for the current tenant.
   * Filterable by period + action prefix.
   */
  listEvents: protectedProcedure
    .input(
      z
        .object({
          since: z.string().datetime().optional(),
          until: z.string().datetime().optional(),
          actionPrefix: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const limit = input?.limit ?? 100;

      const conditions = [eq(schema.auditLogs.tenantId, ctx.tenantId)];
      if (input?.since) {
        conditions.push(gte(schema.auditLogs.createdAt, new Date(input.since)));
      }
      if (input?.until) {
        conditions.push(lte(schema.auditLogs.createdAt, new Date(input.until)));
      }

      const events = await db
        .select({
          id: schema.auditLogs.id,
          actorId: schema.auditLogs.actorId,
          action: schema.auditLogs.action,
          payload: schema.auditLogs.payload,
          ipAddress: schema.auditLogs.ipAddress,
          createdAt: schema.auditLogs.createdAt,
        })
        .from(schema.auditLogs)
        .where(and(...conditions))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(limit);

      const filtered = input?.actionPrefix
        ? events.filter((e) => e.action.startsWith(input.actionPrefix as string))
        : events;

      return { events: filtered, total: filtered.length };
    }),

  /**
   * List signed evidence blobs (hash-chained per ADR 014 §A08).
   */
  listEvidence: protectedProcedure
    .input(
      z
        .object({
          pyramidId: z.string().uuid().optional(),
          kind: z.enum([
            "oscal_ssp",
            "audit_export",
            "directive_signed_pdf",
            "policy_pdf",
            "other",
          ]).optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const limit = input?.limit ?? 50;

      const conditions = [eq(schema.evidenceBlobs.tenantId, ctx.tenantId)];
      if (input?.pyramidId) {
        conditions.push(eq(schema.evidenceBlobs.pyramidId, input.pyramidId));
      }
      if (input?.kind) {
        conditions.push(eq(schema.evidenceBlobs.kind, input.kind));
      }

      const blobs = await db
        .select()
        .from(schema.evidenceBlobs)
        .where(and(...conditions))
        .orderBy(desc(schema.evidenceBlobs.createdAt))
        .limit(limit);

      return { evidence: blobs, total: blobs.length };
    }),

  /**
   * Verify that the hash chain on evidence_blobs is coherent.
   * Returns the first broken link if any.
   */
  verifyChain: protectedProcedure
    .input(z.object({ pyramidId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const conditions = [eq(schema.evidenceBlobs.tenantId, ctx.tenantId)];
      if (input?.pyramidId) {
        conditions.push(eq(schema.evidenceBlobs.pyramidId, input.pyramidId));
      }

      const blobs = await db
        .select({
          id: schema.evidenceBlobs.id,
          contentHash: schema.evidenceBlobs.contentHash,
          prevHash: schema.evidenceBlobs.prevHash,
          createdAt: schema.evidenceBlobs.createdAt,
        })
        .from(schema.evidenceBlobs)
        .where(and(...conditions))
        .orderBy(schema.evidenceBlobs.createdAt);

      let broken: { idx: number; id: string; expected: string | null; got: string | null } | null = null;
      for (let i = 1; i < blobs.length; i++) {
        const prev = blobs[i - 1];
        const cur = blobs[i];
        if (!prev || !cur) continue;
        if (cur.prevHash !== prev.contentHash) {
          broken = {
            idx: i,
            id: cur.id,
            expected: prev.contentHash,
            got: cur.prevHash,
          };
          break;
        }
      }

      return {
        coherent: broken === null,
        eventsChecked: blobs.length,
        firstBrokenLink: broken,
      };
    }),

  /**
   * (Pro+) Export pyramid as OSCAL SSP. Returns a download URL.
   * Status: stub — returns a dummy URL until OSCAL serializer lands (M5+).
   */
  exportOSCAL: protectedProcedure
    .input(z.object({ pyramidId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      ctx.logger.info({ pyramidId: input.pyramidId }, "audit.exportOSCAL");

      // TODO M5+: serialize pyramid to OSCAL JSON, sign, store, return signed URL
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "OSCAL export lands at M5 with the auditor view (J5)",
      });
    }),
});
