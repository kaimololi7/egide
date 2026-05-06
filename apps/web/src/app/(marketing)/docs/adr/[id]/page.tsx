import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

const KNOWN_ADRS = new Set([
  "001-foundation",
  "002-licensing-strategy",
  "003-stack-decision",
  "004-multi-llm-router",
  "005-policy-as-code-multi-target",
  "006-graph-persistence",
  "007-rag-normative",
  "008-job-queue",
  "009-eval-framework",
  "010-approval-workflow",
  "011-agent-strategy",
  "012-terminology",
  "013-mvp-persona",
  "014-security-by-design",
  "015-architectural-principles",
  "016-secure-sdlc",
  "017-frontend-identity",
]);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `ADR ${id.split("-")[0]}`,
    description: `Architecture decision record ${id} — Egide.`,
  };
}

export default async function ADRPage({ params }: PageProps) {
  const { id } = await params;
  if (!KNOWN_ADRS.has(id)) {
    notFound();
  }

  const num = id.split("-")[0];
  const slug = id.replace(/^\d+-/, "").replace(/-/g, " ");
  const githubUrl = `https://github.com/egide/egide/blob/main/docs/adr/${id}.md`;

  return (
    <article className="mx-auto max-w-[760px] px-6 py-16">
      <nav className="text-xs font-mono text-text-muted mb-6">
        <Link href="/docs" className="hover:text-text-primary transition-colors">
          docs
        </Link>
        <span className="mx-1.5">→</span>
        <Link
          href="/docs/adr"
          className="hover:text-text-primary transition-colors"
        >
          adr
        </Link>
        <span className="mx-1.5">→</span>
        <span className="text-text-secondary">{num}</span>
      </nav>

      <header className="border-b border-border pb-6 mb-8">
        <span className="font-mono text-xs text-text-muted">
          ADR {num}
        </span>
        <h1 className="mt-1 font-display text-[34px] leading-tight tracking-tight capitalize">
          {slug}
        </h1>
      </header>

      <div className="rounded-[6px] border border-border bg-surface p-6">
        <p className="text-sm text-text-secondary">
          The full ADR markdown is rendered here at M5 (MDX integration).
          For now, read it directly on GitHub :
        </p>
        <a
          href={githubUrl}
          className="mt-4 inline-flex items-center h-9 px-3 bg-accent text-text-inverse rounded-[6px] text-sm font-medium hover:bg-accent-hover transition-colors"
          rel="noopener noreferrer"
          target="_blank"
        >
          Open on GitHub →
        </a>
      </div>
    </article>
  );
}
