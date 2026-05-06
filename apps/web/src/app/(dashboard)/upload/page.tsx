"use client";
/**
 * /upload — J1 document ingestion page.
 *
 * 1. DropZone: drop/select a document → POST /api/upload → jobId
 * 2. ProgressTimeline: SSE stream of J1 phases until DONE
 * 3. Redirect to /pyramids/:id on completion
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DropZone } from "@/components/DropZone";
import { ProgressTimeline } from "@/components/ProgressTimeline";

export default function UploadPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);

  function handleJobId(id: string) {
    setJobId(id);
  }

  function handleDone(pyramidId: string) {
    router.push(`/pyramids/${pyramidId}`);
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      <h1
        style={{
          fontSize: "var(--text-xl)",
          color: "var(--color-text-primary)",
          fontWeight: 600,
          marginBottom: "4px",
          letterSpacing: "var(--tracking-tight)",
        }}
      >
        Upload document
      </h1>
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          marginBottom: "24px",
          fontFamily: "var(--font-mono)",
        }}
      >
        The extractor parses your document and the compliance agent builds the
        governance pyramid.
      </p>

      {!jobId ? (
        <DropZone onJobId={handleJobId} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "8px",
            }}
          >
            job&nbsp;
            <span style={{ color: "var(--color-accent)" }}>{jobId}</span>
          </div>
          <ProgressTimeline jobId={jobId} onDone={handleDone} />
        </div>
      )}
    </div>
  );
}
