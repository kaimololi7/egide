/**
 * Tenant context middleware (cf. ADR 014 §A01 + threat-models/multi-tenant-isolation.md).
 *
 * Reads the authenticated session from Better-Auth, looks up the user's
 * tenant + role from the operational DB, and exposes them to tRPC procedures.
 *
 * The tenant_id is NEVER read from request body or URL — only from the
 * server-side DB lookup.
 */

import { db, schema } from "@egide/db";
import { eq } from "drizzle-orm";
import type { AuthInstance } from "../auth.js";

export interface ResolvedSession {
  userId: string;
  tenantId: string;
  role: "admin" | "process_owner" | "auditor" | "operator" | "viewer";
}

/**
 * Resolves the authenticated session into a tenant-scoped context.
 *
 * Returns null if:
 *   - no valid session cookie ;
 *   - session userId not found in `users` (orphan / stale session) ;
 *   - user has no tenant (invariant violation — logged elsewhere).
 */
export async function resolveSession(
  auth: AuthInstance,
  req: Request,
): Promise<ResolvedSession | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return null;
  }

  // Lookup tenantId + role from operational DB. We fetch only the columns
  // needed — never the password hash or arbitrary user fields.
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: {
      id: true,
      tenantId: true,
      role: true,
    },
  });

  if (!row) {
    // Session is valid but user record is gone — treat as logged out.
    return null;
  }

  return {
    userId: row.id,
    tenantId: row.tenantId,
    role: row.role,
  };
}
