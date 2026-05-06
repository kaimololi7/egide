import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Architecture decision records" };

interface ADR {
  id: string;
  title: string;
  status?: "amended" | "scope-reduced";
}

const ADRS: ADR[] = [
  { id: "001-foundation", title: "Foundation (positioning, audience, scope)" },
  { id: "002-licensing-strategy", title: "Licensing (AGPL + commercial dual)" },
  { id: "003-stack-decision", title: "Stack (TS + Go + Python)", status: "amended" },
  { id: "004-multi-llm-router", title: "Multi-LLM router with degraded mode", status: "amended" },
  {
    id: "005-policy-as-code-multi-target",
    title: "Policy-as-Code multi-target",
    status: "scope-reduced",
  },
  { id: "006-graph-persistence", title: "Graph persistence (PG recursive CTE + JSONB)" },
  { id: "007-rag-normative", title: "RAG normative (pgvector)" },
  { id: "008-job-queue", title: "Job queue (NATS JetStream from M1)" },
  { id: "009-eval-framework", title: "Eval framework (custom pytest, Inspect AI later)" },
  { id: "010-approval-workflow", title: "Approval workflow primitives" },
  { id: "011-agent-strategy", title: "Agent strategy (super-agent + PydanticAI)" },
  { id: "012-terminology", title: "Terminology (agents / AI workers / collectors)" },
  { id: "013-mvp-persona", title: "MVP persona (technical staff + operational RSSI)" },
  { id: "014-security-by-design", title: "Security by design (OWASP Web + LLM Top 10)" },
  { id: "015-architectural-principles", title: "Architectural principles (hexagonal selective + DDD)" },
  { id: "016-secure-sdlc", title: "Secure SDLC (full-strict from M1)" },
  { id: "017-frontend-identity", title: "Front-end identity and design system" },
];

export default function ADRIndex() {
  return (
    <div className="mx-auto max-w-[860px] px-6 py-16">
      <header className="border-b border-border pb-8 mb-8">
        <h1 className="font-display text-[40px] leading-tight tracking-tight">
          Architecture decision records
        </h1>
        <p className="mt-3 text-lg text-text-secondary">
          Every non-trivial architectural choice is documented as an ADR.
          Amendments are tracked in-place. Nothing decided in private.
        </p>
      </header>

      <ul className="divide-y divide-border border border-border rounded-[6px] overflow-hidden">
        {ADRS.map((adr) => {
          const num = adr.id.split("-")[0];
          return (
            <li key={adr.id}>
              <Link
                href={`/docs/adr/${adr.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-surface transition-colors"
              >
                <span className="font-mono text-xs text-text-muted w-8">
                  {num}
                </span>
                <span className="flex-1 text-sm text-text-primary">
                  {adr.title}
                </span>
                {adr.status ? (
                  <span className="font-mono text-[10px] text-accent uppercase tracking-[0.06em]">
                    {adr.status}
                  </span>
                ) : null}
                <span aria-hidden className="text-text-muted">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-xs text-text-muted">
        Source :{" "}
        <a
          href="https://github.com/egide/egide/tree/main/docs/adr"
          className="text-accent hover:text-accent-hover transition-colors font-mono"
          rel="noopener noreferrer"
          target="_blank"
        >
          docs/adr/
        </a>
      </p>
    </div>
  );
}
