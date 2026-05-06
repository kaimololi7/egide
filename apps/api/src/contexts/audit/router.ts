/**
 * Audit bounded context (cf. ADR 015).
 * Owns evidence blobs, audit logs, OSCAL exports, integrity chain.
 *
 * Status: scaffold. Procedures land at M5+ (J5).
 */

import { router, protectedProcedure } from "../../trpc.js";

export const auditRouter = router({
  listEvents: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.debug("audit.listEvents called");
    return { events: [], total: 0 };
  }),
});
