/**
 * Compliance bounded context (cf. ADR 015).
 * Owns document extraction, classification, gap analysis, SoA.
 *
 * Status: scaffold. Procedures land at M2-M3.
 */

import { router, protectedProcedure } from "../../trpc.js";

export const complianceRouter = router({
  listDocuments: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.debug("compliance.listDocuments called");
    return { documents: [], total: 0 };
  }),
});
