"use client";
/**
 * DropZone — accepts PDF/DOCX/PPTX, 50MB max.
 *
 * On drop/select: calls POST /api/upload with multipart form.
 * Calls onJobId(jobId) so the parent can open the SSE stream.
 *
 * Design: ADR 017 — tokens only, no box-shadow, 8px max radius.
 */
import { useCallback, useRef, useState } from "react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
];
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

interface DropZoneProps {
  onJobId: (jobId: string) => void;
}

export function DropZone({ onJobId }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const file = files[0];
      if (!file) return;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Unsupported format. Accepted: PDF, DOCX, PPTX, TXT, MD.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("File exceeds 50 MB limit.");
        return;
      }

      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const text = await res.text();
          setError(`Upload failed: ${res.status} ${text}`);
          return;
        }
        const body = (await res.json()) as { jobId: string };
        onJobId(body.jobId);
      } catch (err) {
        setError(`Network error: ${(err as Error).message}`);
      } finally {
        setUploading(false);
      }
    },
    [onJobId],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div>
      <button
        type="button"
        aria-label="Drop a document or click to select"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "32px",
          border: `1px dashed ${dragging ? "var(--color-accent)" : "var(--color-border-strong)"}`,
          borderRadius: "var(--radius-lg)",
          background: dragging ? "var(--color-accent-muted)" : "var(--color-surface-raised)",
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "border-color 120ms ease-out, background 120ms ease-out",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          {uploading
            ? "Uploading…"
            : "Drop a PDF, DOCX or PPTX — or click to browse"}
        </span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
          }}
        >
          Max 50 MB · PDF · DOCX · PPTX · TXT · MD
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <p
          role="alert"
          style={{
            marginTop: "8px",
            fontSize: "var(--text-sm)",
            color: "var(--color-danger)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
