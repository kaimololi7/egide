/**
 * SSE route — streams J1 phase events for a given pyramid generation job.
 *
 * GET /api/pyramid-progress/:id
 *
 * Subscribes to NATS subject `egide.v1.pyramid.progress` (published by
 * agents/orchestrator) via an ephemeral JetStream consumer with
 * deliver_policy=all so we replay any frames already emitted before
 * the client connected.
 *
 * Frames are filtered by `pyramid_id` (== route :id). The stream ends
 * when phase ∈ {DONE, FAILED} or after EGIDE_PROGRESS_TIMEOUT_MS.
 *
 * If NATS is unreachable, falls back to a synthetic phase sequence so
 * the front-end stays usable in dev / demo mode.
 *
 * Security:
 *   - jobId validated as UUID (prevents subject injection).
 *   - SSE headers prevent caching / buffering / sniffing.
 *   - Tenant isolation enforced upstream (job creation requires auth).
 *
 * Cf. ADR 008, ADR 014 §A01.
 */
import type { NextRequest } from "next/server";
import { JSONCodec, AckPolicy, DeliverPolicy, ReplayPolicy } from "nats";
import { getJetStream, getNatsConnection } from "@/lib/nats";

// Force Node.js runtime — `nats` lib is not Edge-compatible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROGRESS_SUBJECT = "egide.v1.pyramid.progress";
const STREAM_NAME = "EVENTS";
const TERMINAL_PHASES = new Set(["DONE", "FAILED"]);

const TIMEOUT_MS = Number.parseInt(
  process.env.EGIDE_PROGRESS_TIMEOUT_MS ?? "300000", // 5 min default
  10,
);
const HEARTBEAT_MS = 15_000;

const codec = JSONCodec<Record<string, unknown>>();

interface ProgressFrame {
  pyramid_id?: string;
  phase: string;
  message?: string;
  timestamp?: number | string;
  [k: string]: unknown;
}

const SYNTHETIC_PHASES: ProgressFrame[] = [
  { phase: "QUEUED", message: "job accepted" },
  { phase: "INGESTED", message: "document parsed by extractor" },
  { phase: "CLASSIFYING", message: "classifying chunks" },
  { phase: "ANCHORING", message: "resolving normative anchors" },
  { phase: "DRAFTING", message: "drafting artifacts" },
  { phase: "VALIDATING", message: "running 25 deterministic rules" },
  { phase: "STORING", message: "persisting pyramid" },
  { phase: "DONE", message: "pyramid ready" },
];

function sseFrame(payload: unknown, event?: string): Uint8Array {
  const lines: string[] = [];
  if (event) lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(payload)}`);
  return new TextEncoder().encode(`${lines.join("\n")}\n\n`);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: jobId } = await params;

  if (!UUID_RE.test(jobId)) {
    return new Response(JSON.stringify({ error: "invalid job id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Heartbeat keeps proxies (nginx, cloudflare) from idling out.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          close();
        }
      }, HEARTBEAT_MS);

      const overall = setTimeout(() => {
        if (closed) return;
        try {
          controller.enqueue(
            sseFrame(
              { phase: "TIMEOUT", message: "stream timeout" },
              "timeout",
            ),
          );
        } catch {
          // best effort
        }
        close();
      }, TIMEOUT_MS);

      // Best-effort cleanup on client disconnect.
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearTimeout(overall);
        close();
      });

      let usedNats = false;
      try {
        const conn = await getNatsConnection();
        const js = await getJetStream();
        const jsm = await conn.jetstreamManager();

        // Ephemeral consumer (no durable_name) bound to the EVENTS stream.
        const ciResp = await jsm.consumers.add(STREAM_NAME, {
          filter_subject: PROGRESS_SUBJECT,
          ack_policy: AckPolicy.None, // read-only fan-out
          deliver_policy: DeliverPolicy.All,
          replay_policy: ReplayPolicy.Instant,
          inactive_threshold: 60_000_000_000, // 60s in ns — auto-cleanup
        });

        const consumer = await js.consumers.get(STREAM_NAME, ciResp.name);
        const messages = await consumer.consume();
        usedNats = true;

        req.signal.addEventListener("abort", () => {
          messages.stop();
        });

        for await (const m of messages) {
          if (closed) {
            messages.stop();
            break;
          }
          let frame: ProgressFrame;
          try {
            frame = codec.decode(m.data) as ProgressFrame;
          } catch {
            continue;
          }
          if (frame.pyramid_id && frame.pyramid_id !== jobId) continue;

          controller.enqueue(sseFrame(frame));

          if (TERMINAL_PHASES.has(String(frame.phase))) {
            messages.stop();
            break;
          }
        }
      } catch (err) {
        // NATS unreachable — only fall back if we never entered the consume loop.
        if (!usedNats && !closed) {
          controller.enqueue(
            sseFrame(
              {
                phase: "DEGRADED",
                message:
                  "NATS unreachable; emitting synthetic phases (dev mode)",
                error: err instanceof Error ? err.message : String(err),
              },
              "degraded",
            ),
          );
          for (const ev of SYNTHETIC_PHASES) {
            if (closed) break;
            await new Promise((r) => setTimeout(r, 600));
            controller.enqueue(
              sseFrame({
                ...ev,
                pyramid_id: jobId,
                timestamp: new Date().toISOString(),
              }),
            );
          }
        }
      } finally {
        clearInterval(heartbeat);
        clearTimeout(overall);
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
