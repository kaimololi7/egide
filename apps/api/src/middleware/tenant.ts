/**
 * Tenant context middleware (cf. ADR 014 §A01 + threat-models/multi-tenant-isolation.md).
 *
 * Reads the authenticated session from Better-Auth, looks up the user's
 * tenant + role from the operational DB, and exposes them to tRPC procedures.
 *
 * The tenant_id is NEVER read from request body or URL — only from the
 * server-side DB lookup. The single exception is the service-account
 * auth path (machine-to-machine), which carries an explicit `tenantId`
 * field validated against the service-account scope.
 */

import { db, schema } from "@egide/db";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AuthInstance } from "../auth.js";
import type { Env } from "../env.js";

export type SessionRole =
  | "admin"
  | "process_owner"
  | "auditor"
  | "operator"
  | "viewer"
  | "service";

export interface ResolvedSession {
  userId: string;
  tenantId: string;
  role: SessionRole;
  /** True when the session represents a machine-to-machine service account. */
  service?: boolean;
  /** Service account scopes (only set when service=true). */
  scopes?: readonly string[];
}

interface ServiceAccountConfig {
  /** Stable label for audit purposes (e.g., "orchestrator", "compiler"). */
  label: string;
  /** sha256 hex of the bearer token. Tokens themselves are never stored. */
  tokenHash: string;
  /** Allowed scopes (e.g. "pyramid:persist", "llm:complete"). */
  scopes: readonly string[];
  /** Allowed tenant IDs ("*" = any). */
  allowedTenants: readonly string[];
}

let _serviceAccounts: ServiceAccountConfig[] | null = null;

/**
 * Parse `EGIDE_SERVICE_TOKENS` env var.
 * Format: JSON array of { label, tokenHash, scopes, allowedTenants }.
 *
 * Example:
 *   EGIDE_SERVICE_TOKENS='[{"label":"orchestrator",
 *     "tokenHash":"<sha256-hex>",
 *     "scopes":["pyramid:persist","llm:complete"],
 *     "allowedTenants":["*"]}]'
 */
function loadServiceAccounts(env: Env): ServiceAccountConfig[] {
  if (_serviceAccounts !== null) return _serviceAccounts;
  const raw = env.EGIDE_SERVICE_TOKENS;
  if (!raw) {
    _serviceAccounts = [];
    return _serviceAccounts;
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccountConfig[];
    if (!Array.isArray(parsed)) throw new Error("must be JSON array");
    _serviceAccounts = parsed.map((sa) => ({
      label: String(sa.label),
      tokenHash: String(sa.tokenHash).toLowerCase(),
      scopes: Array.isArray(sa.scopes) ? sa.scopes.map(String) : [],
      allowedTenants: Array.isArray(sa.allowedTenants)
        ? sa.allowedTenants.map(String)
        : [],
    }));
    return _serviceAccounts;
  } catch (err) {
    // Fail closed — invalid env disables the feature.
    console.error("EGIDE_SERVICE_TOKENS parse error:", err);
    _serviceAccounts = [];
    return _serviceAccounts;
  }
}

function constantTimeMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Try to authenticate the request as a service account via
 * Authorization: Bearer <token>. Returns null if no token or no match.
 *
 * The X-Egide-Tenant-Id header is required and must be in the
 * service account's allowedTenants list (or "*" for any).
 *
 * Exported for use by direct Hono routes (e.g. /v1/llm/complete) that
 * don't go through the tRPC context.
 */
export function authenticateServiceAccount(
  env: Env,
  req: Request,
): ResolvedSession | null {
  return resolveServiceAccount(env, req);
}

function resolveServiceAccount(env: Env, req: Request): ResolvedSession | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const accounts = loadServiceAccounts(env);

  const match = accounts.find((sa) => constantTimeMatch(sa.tokenHash, tokenHash));
  if (!match) return null;

  const tenantId = req.headers.get("x-egide-tenant-id");
  if (!tenantId) return null;

  // Validate tenant scope
  const tenantAllowed =
    match.allowedTenants.includes("*") ||
    match.allowedTenants.includes(tenantId);
  if (!tenantAllowed) return null;

  return {
    userId: `service:${match.label}`,
    tenantId,
    role: "service",
    service: true,
    scopes: match.scopes,
  };
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
  env: Env,
): Promise<ResolvedSession | null> {
  // Try service-account first (faster, header-only).
  const svc = resolveServiceAccount(env, req);
  if (svc) return svc;

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
