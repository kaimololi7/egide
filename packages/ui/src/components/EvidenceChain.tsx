/**
 * <EvidenceChain> — visual hash chain of evidence blobs.
 *
 * Cf. docs/design-system.md §EvidenceChain + ADR 017 + ADR 014 §A08.
 * Connects content_hash → prev_hash. Broken chain rendered red.
 */

import type { CSSProperties } from "react";

export interface EvidenceEvent {
  id: string;
  contentHash: string;
  prevHash: string | null;
  kind: string;
  timestamp: string;
  actor?: string;
}

export interface EvidenceChainProps {
  events: EvidenceEvent[];
  onSelect?: (id: string) => void;
  className?: string;
}

function shortHash(h: string): string {
  if (h.length <= 18) return h;
  return `${h.slice(0, 12)}…${h.slice(-4)}`;
}

function isLinkedTo(prev: EvidenceEvent | undefined, current: EvidenceEvent): boolean {
  if (!prev) return current.prevHash === null;
  return current.prevHash === prev.contentHash;
}

export function EvidenceChain({ events, onSelect, className }: EvidenceChainProps) {
  const containerStyle: CSSProperties = {
    fontFamily: "var(--egide-font-ui)",
    color: "var(--egide-color-text-primary)",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  };

  return (
    <ol
      className={className}
      style={{ ...containerStyle, listStyle: "none", margin: 0, padding: 0 }}
      aria-label="Evidence chain"
    >
      {events.map((event, idx) => {
        const previous = events[idx - 1];
        const linked = idx === 0 ? true : isLinkedTo(previous, event);
        const isLast = idx === events.length - 1;

        const rowStyle: CSSProperties = {
          display: "grid",
          gridTemplateColumns: "16px 1fr",
          gap: "var(--egide-space-3)",
          alignItems: "stretch",
        };

        const railStyle: CSSProperties = {
          position: "relative",
          width: 16,
        };

        const dotStyle: CSSProperties = {
          position: "absolute",
          left: 5,
          top: 12,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: linked ? "var(--egide-color-accent)" : "var(--egide-color-danger)",
          border: "1px solid var(--egide-color-bg)",
          boxSizing: "content-box",
        };

        const lineStyle: CSSProperties = isLast
          ? { display: "none" }
          : {
              position: "absolute",
              left: 7,
              top: 22,
              bottom: -2,
              width: 2,
              background: linked
                ? "var(--egide-color-border-strong)"
                : "var(--egide-color-danger)",
            };

        const cardStyle: CSSProperties = {
          padding: "var(--egide-space-3)",
          marginBottom: "var(--egide-space-2)",
          border: "1px solid var(--egide-color-border)",
          borderRadius: "var(--egide-radius)",
          background: "var(--egide-color-surface)",
          cursor: onSelect ? "pointer" : "default",
        };

        return (
          <li key={event.id} style={rowStyle}>
            <div style={railStyle} aria-hidden>
              <span style={lineStyle} />
              <span style={dotStyle} />
            </div>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(event.id)}
                style={{ ...cardStyle, textAlign: "left", width: "100%" }}
              >
                <EventBody event={event} linked={linked} previous={previous} />
              </button>
            ) : (
              <div style={cardStyle}>
                <EventBody event={event} linked={linked} previous={previous} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function EventBody({
  event,
  linked,
  previous,
}: {
  event: EvidenceEvent;
  linked: boolean;
  previous: EvidenceEvent | undefined;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--egide-space-2)",
          marginBottom: "var(--egide-space-1)",
        }}
      >
        <span
          style={{
            fontSize: "var(--egide-text-xs)",
            fontFamily: "var(--egide-font-mono)",
            color: "var(--egide-color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "var(--egide-tracking-wide)",
          }}
        >
          {event.kind}
        </span>
        <time
          style={{
            fontSize: "var(--egide-text-xs)",
            color: "var(--egide-color-text-muted)",
            fontFeatureSettings: '"tnum"',
          }}
          dateTime={event.timestamp}
        >
          {event.timestamp}
        </time>
      </div>
      <div
        style={{
          fontFamily: "var(--egide-font-mono)",
          fontSize: "var(--egide-text-sm)",
          color: linked ? "var(--egide-color-text-primary)" : "var(--egide-color-danger)",
        }}
      >
        {shortHash(event.contentHash)}
      </div>
      {!linked && previous && (
        <div
          style={{
            marginTop: "var(--egide-space-1)",
            fontSize: "var(--egide-text-xs)",
            color: "var(--egide-color-danger)",
          }}
        >
          ⚠ chain broken — prev_hash mismatch
        </div>
      )}
      {event.actor && (
        <div
          style={{
            marginTop: "var(--egide-space-1)",
            fontSize: "var(--egide-text-xs)",
            color: "var(--egide-color-text-secondary)",
          }}
        >
          by {event.actor}
        </div>
      )}
    </>
  );
}
