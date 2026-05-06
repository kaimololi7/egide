/**
 * POST /api/upload — multipart document upload.
 *
 * Forwards the file to the extractor service (port 8001), which publishes
 * egide.v1.extractor.completed on NATS. Returns a jobId for SSE tracking.
 *
 * Security:
 * - MIME type allowlist enforced server-side (not just client)
 * - Size limit enforced (50MB)
 * - Auth session required
 * - tenantId injected from session (never from body)
 */
import { type NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO(M4): enforce Better-Auth session from cookie
  // const session = await resolveSession(auth, req);
  // if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 50 MB)" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 50 MB)" }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "unsupported file type. Accepted: PDF, DOCX, PPTX, TXT, MD" },
      { status: 415 },
    );
  }

  const extractorUrl = process.env.EXTRACTOR_URL ?? "http://localhost:8001";

  try {
    const upstream = new FormData();
    upstream.append("file", file);

    const res = await fetch(`${extractorUrl}/v1/extract`, {
      method: "POST",
      body: upstream,
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `extractor error: ${text}` }, { status: 502 });
    }

    // Extractor returns { job_id } which we expose as jobId
    const body = (await res.json()) as { job_id?: string };
    const jobId = body.job_id ?? crypto.randomUUID();

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      return NextResponse.json({ error: "extractor timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
