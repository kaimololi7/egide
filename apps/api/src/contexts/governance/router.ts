/**
 * Governance bounded context (cf. ADR 015).
 * Owns directives, approvals, signatures, RBAC, license check.
 *
 * Status: scaffold. Procedures land progressively (approvals M2,
 * directives M17 with J6).
 */

import { router, protectedProcedure } from "../../trpc.js";

export const governanceRouter = router({
  listApprovals: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.debug("governance.listApprovals called");
    return { approvals: [], total: 0 };
  }),
});
