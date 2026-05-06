/**
 * Dashboard layout — sidebar + topbar shell.
 *
 * Design rules (ADR 017):
 * - 32px row density, border separation only (no box-shadow)
 * - Tokens only, no hardcoded colors
 * - Dark mode default
 * - Border-radius max 8px
 */
import type { ReactNode } from "react";
import Link from "next/link";

const nav = [
  { href: "/upload", label: "Upload document" },
  { href: "/pyramids", label: "Pyramids" },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex flex-col w-52 shrink-0 border-r"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        {/* Wordmark */}
        <div
          className="flex items-center px-4"
          style={{ height: "48px", borderBottom: "1px solid var(--color-border)" }}
        >
          <span
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "var(--text-base)", color: "var(--color-accent)" }}
          >
            egide
          </span>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              marginLeft: "6px",
              fontFamily: "var(--font-mono)",
            }}
          >
            community
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0 py-2 flex-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-4 transition-colors"
              style={{
                height: "32px",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="px-4 py-3"
          style={{
            borderTop: "1px solid var(--color-border)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          v0.1.0-dev
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header
          className="flex items-center px-6"
          style={{
            height: "48px",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Egide GRC
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
