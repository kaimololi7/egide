/**
 * Egide API gateway entry point.
 *
 * Bun + Hono + tRPC + Better-Auth + OTel.
 * 5 bounded context routers (cf. ADR 015) + health.
 *
 * Status: scaffold. Boots, exposes /health, accepts tRPC calls.
 * Bounded context routers are stubs returning placeholders.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { trpcServer } from "@hono/trpc-server";
import { loadEnv } from "./env.js";
import { appRouter, createContext } from "./trpc.js";
import { createAuth } from "./auth.js";
import { healthRoutes } from "./contexts/health/routes.js";
import { llmRoutes } from "./contexts/llm/routes.js";
import { logger as makeLogger } from "./shared/logger.js";

type Variables = {
  traceId: string;
};

const env = loadEnv();
const logger = makeLogger(env);
const auth = createAuth(env);

const app = new Hono<{ Variables: Variables }>();

// ── Security headers (cf. ADR 014 §A05) ────────────────
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
    strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
    referrerPolicy: "no-referrer",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
  }),
);

// ── CORS — restrict to web app origin ─────────────────
app.use(
  "*",
  cors({
    origin: (origin) => {
      // TODO: tighten via env (CORS_ORIGINS) once apps/web has a host.
      return origin ?? "*";
    },
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    exposeHeaders: ["X-Trace-Id"],
  }),
);

// ── Trace ID propagation ──────────────────────────────
app.use("*", async (c, next) => {
  const traceId = c.req.header("x-trace-id") ?? crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);
  await next();
});

// ── Health (always available, no auth) ─────────────────
app.route("/health", healthRoutes());

// ── /v1/llm/* — direct service-account routes (cf. ADR 004) ──
app.route("/v1/llm", llmRoutes(env, logger));

// ── Better-Auth handler at /api/auth/* ─────────────────
// (cf. ADR 014 §A07 — authentication endpoints)
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

// ── tRPC mount under /trpc ─────────────────────────────
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/trpc",
    router: appRouter,
    createContext: (opts, c) =>
      createContext({
        req: opts.req,
        traceId: c.get("traceId"),
        env,
        logger,
        auth,
      }) as unknown as Record<string, unknown>,
    onError({ error, path }) {
      logger.error({ err: error, path }, "tRPC error");
    },
  }),
);

// ── Catch-all 404 ──────────────────────────────────────
app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        trace_id: c.get("traceId"),
      },
    },
    404,
  ),
);

// ── Global error handler ───────────────────────────────
app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, "unhandled error");
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        trace_id: c.get("traceId"),
      },
    },
    500,
  );
});

logger.info({ port: env.PORT, host: env.HOST }, "egide-api starting");

export default {
  port: env.PORT,
  hostname: env.HOST,
  fetch: app.fetch,
};
