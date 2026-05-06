/**
 * Compliance bounded context (cf. ADR 015).
 * Owns document extraction, classification, gap analysis, SoA.
 *
 * Procedures:
 *   - upload   : POST signed URL for client to upload to S3 (returns key)
 *   - listDocuments : enumerate uploaded docs for the current tenant
 *   - classify : trigger an extractor + classification job (NATS publish)
 *   - listChunks    : enumerate ontology chunks for the current tenant (RAG inspection)
 */

import { db, schema } from "@egide/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { presignTenantUpload } from "../../shared/s3.js";
import { protectedProcedure, router } from "../../trpc.js";

const uploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  expiresIn: z.number().int(),
});

export const complianceRouter = router({
  /**
   * List documents uploaded by this tenant.
   * Reads from evidence_blobs filtered by kind.
   */
  listDocuments: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      ctx.logger.debug({ limit, offset }, "compliance.listDocuments");

      const docs = await db
        .select({
          id: schema.evidenceBlobs.id,
          storageKey: schema.evidenceBlobs.storageKey,
          contentHash: schema.evidenceBlobs.contentHash,
          metadata: schema.evidenceBlobs.metadata,
          createdAt: schema.evidenceBlobs.createdAt,
        })
        .from(schema.evidenceBlobs)
        .where(
          and(
            eq(schema.evidenceBlobs.tenantId, ctx.tenantId),
            eq(schema.evidenceBlobs.kind, "other"),
          ),
        )
        .orderBy(desc(schema.evidenceBlobs.createdAt))
        .limit(limit)
        .offset(offset);

      return { documents: docs, total: docs.length };
    }),

  /**
   * Request a signed upload URL. The web client PUTs the file directly
   * to MinIO/S3 ; on completion, the client calls compliance.classify
   * with the returned storageKey.
   *
   * The signed URL embeds tenantId in the key prefix so a leaked URL
   * cannot be used to write into another tenant's namespace.
   */
  requestUpload: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z
          .string()
          .min(3)
          .regex(/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/, "invalid mime type"),
        sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      ctx.logger.info(
        { filename: input.filename, contentType: input.contentType },
        "compliance.requestUpload",
      );

      const presigned = await presignTenantUpload(ctx.env, {
        tenantId: ctx.tenantId,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      });

      return uploadResponseSchema.parse(presigned);
    }),

  /**
   * Trigger a classification job. Publishes egide.v1.docs.uploaded on NATS
   * which the orchestrator picks up to drive the J1 pipeline.
   */
  classify: protectedProcedure
    .input(
      z.object({
        storageKey: z.string().min(1),
        mimeType: z.string().min(3),
        sizeBytes: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const docId = crypto.randomUUID();
      ctx.logger.info(
        { docId, tenantId: ctx.tenantId, storageKey: input.storageKey },
        "compliance.classify → publishing egide.v1.docs.uploaded",
      );

      // Persist a minimal evidence_blobs row so listDocuments can show it.
      await db.insert(schema.evidenceBlobs).values({
        id: docId,
        tenantId: ctx.tenantId,
        kind: "other",
        storageKey: input.storageKey,
        contentHash: "pending",
        metadata: { mimeType: input.mimeType, sizeBytes: input.sizeBytes },
      });

      // TODO M3: NatsClient.publish(Subjects.DocsUploaded, {...})
      // For now, return the doc_id so the client can subscribe to progress.

      return { docId, status: "queued" };
    }),

  /**
   * List normative chunks for RAG inspection.
   * Note: ontology_chunks is a global table (no tenant_id) at MVP — every
   * tenant sees the same normative corpus. Tenant overrides land at M9+.
   */
  listChunks: protectedProcedure
    .input(
      z
        .object({
          framework: z.string().optional(),
          cluster: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const limit = input?.limit ?? 100;

      const conditions = [];
      if (input?.framework) {
        conditions.push(eq(schema.ontologyChunks.framework, input.framework));
      }
      if (input?.cluster) {
        conditions.push(eq(schema.ontologyChunks.cluster, input.cluster));
      }

      const baseQuery = db
        .select({
          id: schema.ontologyChunks.id,
          framework: schema.ontologyChunks.framework,
          clause: schema.ontologyChunks.clause,
          cluster: schema.ontologyChunks.cluster,
          title: schema.ontologyChunks.title,
          text: schema.ontologyChunks.text,
        })
        .from(schema.ontologyChunks);

      const chunks = await (conditions.length > 0
        ? baseQuery.where(and(...conditions)).limit(limit)
        : baseQuery.limit(limit));

      return { chunks, total: chunks.length };
    }),
});
