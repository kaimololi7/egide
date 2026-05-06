/**
 * LiveStatus — repository-state strip rendered between the hero and the
 * standards bar. Server component, ISR 1h. Fetches GitHub REST API for
 * latest release, latest commit, open issues, and CI status.
 *
 * Resilience: every fetch is wrapped with a 5s AbortController and
 * `Promise.allSettled` so a single API hiccup never blocks the page.
 * Missing values fall back to "—" without breaking the layout.
 *
 * No GitHub token required (60 req/hr unauth × 1h ISR cache = safe).
 */
import { GitCommit, GitPullRequest, Tag, ZapOff } from "lucide-react";
import styles from "./LiveStatus.module.css";

export const revalidate = 3600;

const REPO = process.env.EGIDE_LANDING_REPO ?? "egide-platform/egide";

interface FetchOpts {
  url: string;
  timeoutMs?: number;
}

async function ghFetch<T>({ url, timeoutMs = 5000 }: FetchOpts): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "egide-landing",
      },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
  if (diffSec < 86400 * 365) return `${Math.floor(diffSec / (86400 * 30))}mo ago`;
  return `${Math.floor(diffSec / (86400 * 365))}y ago`;
}

interface ReleaseDTO {
  tag_name?: string;
  published_at?: string;
}
interface CommitDTO {
  sha?: string;
  commit?: { author?: { date?: string } };
}
interface SearchDTO {
  total_count?: number;
}
interface RunsDTO {
  workflow_runs?: { conclusion: string | null; status: string }[];
}

async function loadStatus() {
  const base = `https://api.github.com/repos/${REPO}`;
  const [release, commit, issues, runs] = await Promise.all([
    ghFetch<ReleaseDTO>({ url: `${base}/releases/latest` }),
    ghFetch<CommitDTO>({ url: `${base}/commits/HEAD` }),
    ghFetch<SearchDTO>({
      url: `https://api.github.com/search/issues?q=repo:${REPO}+is:open+is:issue`,
    }),
    ghFetch<RunsDTO>({
      url: `${base}/actions/runs?branch=main&per_page=10`,
    }),
  ]);

  const greenRuns =
    runs?.workflow_runs?.filter((r) => r.conclusion === "success").length ?? null;
  const totalRuns = runs?.workflow_runs?.length ?? null;

  return {
    release: {
      tag: release?.tag_name ?? "—",
      ago: relativeTime(release?.published_at),
    },
    commit: {
      sha: commit?.sha?.slice(0, 7) ?? "—",
      ago: relativeTime(commit?.commit?.author?.date),
    },
    openIssues: typeof issues?.total_count === "number" ? issues.total_count : null,
    ci: {
      green: greenRuns,
      total: totalRuns,
    },
  };
}

export async function LiveStatus() {
  const status = await loadStatus();
  const ciHealthy =
    status.ci.green !== null && status.ci.total !== null && status.ci.green === status.ci.total;

  return (
    <section className={styles.bar} aria-label="Repository live status">
      <div className={styles.inner}>
        <div className={styles.cell}>
          <Tag size={12} aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>release</span>
          <span className={styles.value}>{status.release.tag}</span>
          <span className={styles.muted}>· {status.release.ago}</span>
        </div>
        <div className={styles.cell}>
          <GitCommit size={12} aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>commit</span>
          <span className={styles.value}>{status.commit.sha}</span>
          <span className={styles.muted}>· {status.commit.ago}</span>
        </div>
        <div className={styles.cell}>
          <GitPullRequest size={12} aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>open issues</span>
          <span className={styles.value}>
            {status.openIssues ?? "—"}
          </span>
        </div>
        <div className={styles.cell}>
          {ciHealthy ? (
            <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden="true" />
          ) : (
            <ZapOff size={12} aria-hidden="true" className={styles.icon} />
          )}
          <span className={styles.label}>CI</span>
          <span className={styles.value}>
            {status.ci.green ?? "—"}/{status.ci.total ?? "—"} green
          </span>
        </div>
        <a
          className={styles.link}
          href={`https://github.com/${REPO}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          github.com/{REPO} ↗
        </a>
      </div>
    </section>
  );
}
