/**
 * tRPC root router.
 *
 * All procedures grouped under v1 namespace per ADR 015 (API versioning).
 * Bounded contexts: pyramid / compilation / compliance / audit /
 * governance + health.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type pino from "pino";
import type { AuthInstance } from "./auth.js";
import type { Env } from "./env.js";
import { resolveSession, type ResolvedSession } from "./middleware/tenant.js";
import { pyramidRouter } from "./contexts/pyramid/router.js";
import { compilationRouter } from "./contexts/compilation/router.js";
import { complianceRouter } from "./contexts/compliance/router.js";
import { auditRouter } from "./contexts/audit/router.js";
import { governanceRouter } from "./contexts/governance/router.js";

export interface ApiContext {
  /** Trace ID for OTel propagation. */
  traceId: string;
  /** Authenticated session — null on unauth routes. */
  session: ResolvedSession | null;
  /** Always populated after auth middleware. */
  tenantId: string | null;
  /** Validated env. */
  env: Env;
  /** Structured logger bound with traceId. */
  logger: pino.Logger;
}

export interface CreateContextArgs {
  req: Request;
  traceId: string;
  env: Env;
  logger: pino.Logger;
  auth: AuthInstance;
}

export async function createContext(args: CreateContextArgs): Promise<ApiContext> {
  const session = await resolveSession(args.auth, args.req, args.env);
  return {
    traceId: args.traceId,
    session,
    tenantId: session?.tenantId ?? null,
    env: args.env,
    logger: args.logger.child({
      traceId: args.traceId,
      ...(session && { tenantId: session.tenantId, actorId: session.userId }),
    }),
  };
}

const t = initTRPC.context<ApiContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Hide stack in prod (cf. ADR 014 §A05)
        stack: undefined,
        cause: undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Authenticated procedure — requires a valid session. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      tenantId: ctx.session.tenantId,
    },
  });
});

/** Admin-only — for high-privilege operations. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "admin role required" });
  }
  return next({ ctx });
});

/**
 * Service-account procedure — accepts machine-to-machine bearer tokens
 * (orchestrator, compiler, future internal workers). The caller must
 * supply X-Egide-Tenant-Id header so we know which tenant to scope to.
 *
 * Use a `requireScope` callback to enforce specific scopes per
 * procedure (e.g., "pyramid:persist", "llm:complete").
 */
export function serviceProcedure(requiredScope: string) {
  return t.procedure.use(({ ctx, next }) => {
    if (!ctx.session?.service) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "service-account auth required",
      });
    }
    if (!ctx.session.scopes?.includes(requiredScope)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `scope ${requiredScope} required`,
      });
    }
    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        tenantId: ctx.session.tenantId,
      },
    });
  });
}

/**
 * Root router — all subrouters under v1 namespace.
 * Cf. ADR 015 (API versioning from v1).
 */
export const appRouter = router({
  v1: router({
    pyramid: pyramidRouter,
    compilation: compilationRouter,
    compliance: complianceRouter,
    audit: auditRouter,
    governance: governanceRouter,
  }),
});

export type AppRouter = typeof appRouter;
