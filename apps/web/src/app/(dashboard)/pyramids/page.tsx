/**
 * /pyramids — list of generated pyramids for the current tenant.
 *
 * Server component — fetches from tRPC API directly.
 * Design: ADR 017 — 32px rows, tokens only.
 */
import Link from "next/link";

interface PyramidSummary {
  id: string;
  title: string;
  status: "draft" | "review" | "published";
  updatedAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--color-text-muted)",
  review: "var(--color-warning)",
  published: "var(--color-success)",
};

// TODO(M4): replace with tRPC server-side call once DB is hydrated
async function fetchPyramids(): Promise<PyramidSummary[]> {
  return [];
}

export default async function PyramidsPage() {
  const pyramids = await fetchPyramids();

  return (
    <div style={{ maxWidth: "900px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-xl)",
            color: "var(--color-text-primary)",
            fontWeight: 600,
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          Pyramids
        </h1>
        <Link
          href="/upload"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: "32px",
            paddingInline: "12px",
            background: "var(--color-accent-muted)",
            border: "1px solid var(--color-accent)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-sm)",
            color: "var(--color-accent)",
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
          }}
        >
          + New
        </Link>
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 140px",
            height: "32px",
            alignItems: "center",
            paddingInline: "12px",
            borderBottom: "1px solid var(--color-border-strong)",
            background: "var(--color-surface-raised)",
          }}
        >
          {["TITLE", "STATUS", "UPDATED"].map((col) => (
            <span
              key={col}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
              }}
            >
              {col}
            </span>
          ))}
        </div>

        {pyramids.length === 0 ? (
          <div
            style={{
              height: "64px",
              display: "flex",
              alignItems: "center",
              paddingInline: "12px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
              }}
            >
              No pyramids yet —{" "}
              <Link
                href="/upload"
                style={{ color: "var(--color-accent)", textDecoration: "none" }}
              >
                upload a document
              </Link>{" "}
              to generate your first.
            </span>
          </div>
        ) : (
          pyramids.map((p) => (
            <Link
              key={p.id}
              href={`/pyramids/${p.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 140px",
                  height: "32px",
                  alignItems: "center",
                  paddingInline: "12px",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.title}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-xs)",
                    color: STATUS_COLOR[p.status] ?? "var(--color-text-muted)",
                  }}
                >
                  {p.status}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
