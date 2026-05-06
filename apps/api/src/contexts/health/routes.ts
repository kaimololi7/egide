/**
 * Health endpoints — always available, no auth required.
 *
 * - /health         liveness (200 if process is up)
 * - /health/ready   readiness (200 if dependencies are reachable)
 * - /health/version build metadata
 */

import { Hono } from "hono";

export function healthRoutes(): Hono {
  const r = new Hono();

  r.get("/", (c) =>
    c.json({ status: "ok", uptime_s: Math.floor(process.uptime()) }),
  );

  r.get("/ready", async (c) => {
    // TODO M1 S2: ping postgres / nats / redis.
    return c.json({ status: "ok", checks: {} });
  });

  r.get("/version", (c) =>
    c.json({
      service: "egide-api",
      version: "0.0.1",
      commit: process.env.GIT_COMMIT ?? "unknown",
      built_at: process.env.BUILD_TIME ?? "unknown",
    }),
  );

  return r;
}
