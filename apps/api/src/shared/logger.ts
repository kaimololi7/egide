/**
 * Structured logger (pino) with PII redaction.
 *
 * Cf. ADR 014 §A09 + threat-models/api-gateway.md §Information disclosure.
 */

import pino from "pino";
import type { Env } from "../env.js";

export function logger(env: Env): pino.Logger {
  return pino({
    name: env.OTEL_SERVICE_NAME,
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "*.password",
        "*.secret",
        "*.api_key",
        "*.apiKey",
        "*.token",
        "*.authorization",
        "req.headers.authorization",
        "req.headers.cookie",
        "*.byok.*",
        "*.signed_key",
        "*.signature",
      ],
      remove: false,
      censor: "[REDACTED]",
    },
    // Pretty print in dev
    transport:
      env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "trace"
        ? {
            target: "pino-pretty",
            options: { colorize: true, singleLine: false },
          }
        : undefined,
  });
}
