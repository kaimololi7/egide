/**
 * Better-Auth instance — Postgres-backed sessions, OAuth providers,
 * argon2id passwords, MFA-ready.
 *
 * Cf. ADR 014 §A07 + threat-models/api-gateway.md.
 *
 * Status: scaffold. Adapter wired ; OAuth providers + MFA enabled
 * progressively (M1 S2 + M3+).
 */

import { betterAuth } from "better-auth";
import { Pool } from "pg";
import type { Env } from "./env.js";

export interface AuthInstance {
  handler: ReturnType<typeof betterAuth>["handler"];
  api: ReturnType<typeof betterAuth>["api"];
}

export function createAuth(env: Env): AuthInstance {
  // Better-Auth supports a Postgres adapter via `database` accepting a Pool.
  const pool = new Pool({ connectionString: env.POSTGRES_URL });

  const auth = betterAuth({
    database: pool,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    // Email + password (argon2id by default in better-auth).
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: false, // tighten for prod via env
    },

    // Cookie hardening — cf. threat-models/api-gateway.md
    advanced: {
      useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
      cookiePrefix: "egide",
      defaultCookieAttributes: {
        sameSite: "lax",
        httpOnly: true,
      },
    },

    // Rate limiting (per-IP, in-memory by default ; Redis store at M2).
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
    },

    // Sessions
    session: {
      expiresIn: 60 * 60 * 4, // 4h Pro / 8h Community — adjust per edition
      updateAge: 60 * 60, // refresh hourly
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },

    // OAuth providers — wired at M1 S2 once redirect URLs are decided.
    // socialProviders: {
    //   github: { clientId: env.GITHUB_OAUTH_ID, clientSecret: env.GITHUB_OAUTH_SECRET },
    //   google: { clientId: env.GOOGLE_OAUTH_ID, clientSecret: env.GOOGLE_OAUTH_SECRET },
    // },
  });

  return { handler: auth.handler, api: auth.api };
}
