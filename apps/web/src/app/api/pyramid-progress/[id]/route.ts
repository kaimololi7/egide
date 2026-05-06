/**
 * SSE route — streams J1 phase events for a given job.
 *
 * GET /api/pyramid-progress/:id
 *
 * In production this subscribes to NATS egide.v1.pyramid.* subjects
 * and forwards events as SSE text/event-stream frames.
 *
 * For M3 this streams a synthetic sequence so the front-end can be
 * developed and tested without a live NATS server. NATS integration
 * lands at M4 (Batch U).
 *
 * Security: jobId validated as UUID to prevent path traversal.
 */
import type { NextRequest } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SYNTHETIC_PHASES = [
  { phase: "QUEUED", delay: 0, message: "job accepted" },
  { phase: "INGESTED", delay: 800, message: "document parsed by extractor" },
  { phase: "CLASSIFYING", delay: 1200, message: "classifying chunks" },
  { phase: "ANCHORING", delay: 1800, message: "resolving normative anchors" },
  { phase: "DRAFTING", delay: 2600, message: "drafting artifacts" },
  { phase: "VALIDATING", delay: 3400, message: "running 25 deterministic rules" },
  { phase: "STORING", delay: 4000, message: "persisting pyramid" },
  { phase: "DONE", delay: 4400, message: "pyramid ready", pyramid_id: null as string | null },
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: jobId } = await params;

  if (!UUID_RE.test(jobId)) {
    return new Response(JSON.stringify({ error: "invalid job id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const synthPyramidId = crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      for (const event of SYNTHETIC_PHASES) {
        await new Promise((r) => setTimeout(r, event.delay));
        const payload: Record<string, unknown> = {
          phase: event.phase,
          timestamp: new Date().toISOString(),
          message: event.message,
        };
        if (event.phase === "DONE") {
          payload.pyramid_id = synthPyramidId;
        }
        const frame = `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // Security headers
      "X-Content-Type-Options": "nosniff",
    },
  });
}
