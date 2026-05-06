"use client";
/**
 * ProgressTimeline — consumes SSE from /api/pyramid-progress/:jobId
 * and renders J1 phase transitions as a vertical timeline.
 *
 * Phases: QUEUED → INGESTED → CLASSIFYING → ANCHORING →
 *         DRAFTING → VALIDATING → STORING → DONE
 *
 * Design: ADR 017 — 32px rows, border separation, tokens only.
 */
import { useEffect, useRef, useState } from "react";

const PHASES = [
  "QUEUED",
  "INGESTED",
  "CLASSIFYING",
  "ANCHORING",
  "DRAFTING",
  "VALIDATING",
  "STORING",
  "DONE",
] as const;

type Phase = (typeof PHASES)[number];

interface PhaseEvent {
  phase: Phase;
  timestamp: string;
  message?: string;
}

interface ProgressTimelineProps {
  jobId: string;
  onDone?: (pyramidId: string) => void;
}

function phaseColor(phase: Phase, current: Phase | null): string {
  if (phase === "DONE" && current === "DONE") return "var(--color-success)";
  const currentIdx = current ? PHASES.indexOf(current) : -1;
  const phaseIdx = PHASES.indexOf(phase);
  if (phaseIdx < currentIdx) return "var(--color-accent)";
  if (phaseIdx === currentIdx) return "var(--color-warning)";
  return "var(--color-text-muted)";
}

export function ProgressTimeline({ jobId, onDone }: ProgressTimelineProps) {
  const [events, setEvents] = useState<PhaseEvent[]>([]);
  const [current, setCurrent] = useState<Phase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/pyramid-progress/${encodeURIComponent(jobId)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as PhaseEvent & { pyramid_id?: string };
        setEvents((prev) => [...prev, data]);
        setCurrent(data.phase);
        if (data.phase === "DONE" && onDone && data.pyramid_id) {
          onDone(data.pyramid_id);
        }
      } catch {
        // malformed SSE frame — ignore
      }
    };

    es.onerror = () => {
      setError("Connection lost — the server may have closed the stream.");
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {PHASES.map((phase) => {
        const evt = events.find((e) => e.phase === phase);
        const active = current === phase;

        return (
          <div
            key={phase}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              height: "32px",
              borderBottom: "1px solid var(--color-border)",
              paddingLeft: "4px",
            }}
          >
            {/* Dot */}
            <span
              aria-hidden="true"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: phaseColor(phase, current),
                flexShrink: 0,
                transition: "background 120ms ease-out",
              }}
            />
            {/* Phase name */}
            <span
              style={{
                width: "120px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: phaseColor(phase, current),
                fontWeight: active ? 600 : 400,
              }}
            >
              {phase}
            </span>
            {/* Timestamp or message */}
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {evt
                ? evt.message
                  ? evt.message
                  : new Date(evt.timestamp).toLocaleTimeString()
                : "—"}
            </span>
          </div>
        );
      })}

      {error && (
        <p
          role="alert"
          style={{
            marginTop: "8px",
            fontSize: "var(--text-xs)",
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
