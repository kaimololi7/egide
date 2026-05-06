/**
 * pyramid commands — M3 implementation.
 *
 * All commands call the tRPC API gateway via plain fetch.
 * Auth token read from ~/.egide/session.json (set by `egide auth login`).
 * API base URL from EGIDE_API_URL env (default http://localhost:3001).
 */
import { Command } from "commander";
import kleur from "kleur";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiUrl(): string {
  return process.env.EGIDE_API_URL ?? "http://localhost:3001";
}

function authToken(): string | null {
  const sessionPath = join(homedir(), ".egide", "session.json");
  if (!existsSync(sessionPath)) return null;
  try {
    const raw = readFileSync(sessionPath, "utf8");
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

async function trpc<T>(
  path: string,
  method: "GET" | "POST",
  input?: unknown,
): Promise<T> {
  const token = authToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url =
    method === "GET"
      ? `${apiUrl()}/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input ?? {} }))}`
      : `${apiUrl()}/trpc/${path}`;

  const res = await fetch(url, {
    method,
    headers,
    ...(method === "POST" ? { body: JSON.stringify({ json: input }) } : {}),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401) {
    process.stderr.write(
      `${kleur.red("✗")} Not authenticated. Run: ${kleur.bold("egide auth login")}\n`,
    );
    process.exit(1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { result?: { data?: { json?: T } } };
  return body.result?.data?.json as T;
}

// ── Commands ────────────────────────────────────────────────────────────────────

export const pyramidCommand = new Command("pyramid").description(
  "generate, validate, and inspect pyramids",
);

// ── pyramid generate ──────────────────────────────────────────────────────────

pyramidCommand
  .command("generate")
  .description("generate a pyramid from documents or templates")
  .option(
    "--frameworks <list>",
    "comma-separated framework IDs (iso27001,nis2,...)",
    "iso27001-2022,nis2",
  )
  .option("--input <path>", "path to documents folder or file", "./docs")
  .option(
    "--mode <mode>",
    "ai mode (template_only|byok|local|hybrid)",
    "template_only",
  )
  .option("--title <title>", "pyramid title", "Untitled pyramid")
  .action(async (opts: { frameworks: string; input: string; mode: string; title: string }) => {
    const inputPath = resolve(opts.input);
    if (!existsSync(inputPath)) {
      process.stderr.write(`${kleur.red("✗")} Input path not found: ${inputPath}\n`);
      process.exit(1);
    }

    const frameworks = opts.frameworks
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    if (frameworks.length === 0) {
      process.stderr.write(`${kleur.red("✗")} --frameworks cannot be empty\n`);
      process.exit(1);
    }

    // Collect files (if dir, list top-level supported files)
    const stat = statSync(inputPath);
    let files: string[] = [];
    if (stat.isDirectory()) {
      files = readdirSync(inputPath)
        .filter((f) => /\.(pdf|docx|pptx|txt|md)$/i.test(f))
        .map((f) => join(inputPath, f));
    } else {
      files = [inputPath];
    }

    if (files.length === 0) {
      process.stderr.write(
        `${kleur.yellow("!")} No supported files found at ${inputPath}\n`,
      );
    } else {
      process.stdout.write(
        `${kleur.dim("→")} Found ${files.length} file(s): ${files.map((f) => basename(f)).join(", ")}\n`,
      );
    }

    process.stdout.write(
      `${kleur.dim("→")} Frameworks: ${kleur.cyan(frameworks.join(", "))}\n`,
    );
    process.stdout.write(`${kleur.dim("→")} Mode: ${kleur.cyan(opts.mode)}\n`);
    process.stdout.write(`${kleur.dim("→")} Submitting to API…\n`);

    try {
      const result = (await trpc<{ jobId: string; status: string; message: string }>(
        "pyramid.create",
        "POST",
        { title: opts.title, frameworks, mode: opts.mode },
      )) as { jobId: string; status: string; message: string };

      process.stdout.write(
        `${kleur.green("✓")} Job queued: ${kleur.bold(result.jobId)}\n`,
      );
      process.stdout.write(
        `${kleur.dim("  ")}${result.message}\n`,
      );
      process.stdout.write(
        `${kleur.dim("  ")}Poll: ${kleur.bold(`egide pyramid show ${result.jobId}`)}\n`,
      );
    } catch (err) {
      process.stderr.write(`${kleur.red("✗")} ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ── pyramid list ──────────────────────────────────────────────────────────────

pyramidCommand
  .command("list")
  .description("list pyramids for the current tenant")
  .option("--json", "output raw JSON", false)
  .action(async (opts: { json: boolean }) => {
    try {
      const result = (await trpc<{ pyramids: { id: string; title: string; status: string; updatedAt: string }[]; total: number }>(
        "pyramid.list",
        "GET",
      )) as { pyramids: { id: string; title: string; status: string; updatedAt: string }[]; total: number };

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      if (result.pyramids.length === 0) {
        process.stdout.write(
          `${kleur.dim("—")} No pyramids found. Run: ${kleur.bold("egide pyramid generate")}\n`,
        );
        return;
      }

      // Table header
      process.stdout.write(
        `${kleur.dim("ID".padEnd(38))} ${kleur.dim("STATUS".padEnd(12))} ${kleur.dim("TITLE")}\n`,
      );
      for (const p of result.pyramids) {
        const statusColor =
          p.status === "published"
            ? kleur.green
            : p.status === "review"
              ? kleur.yellow
              : kleur.dim;
        process.stdout.write(
          `${kleur.dim(p.id)} ${statusColor(p.status.padEnd(12))} ${p.title}\n`,
        );
      }
    } catch (err) {
      process.stderr.write(`${kleur.red("✗")} ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ── pyramid validate ──────────────────────────────────────────────────────────

pyramidCommand
  .command("validate <id>")
  .description("re-run coherence rules on a pyramid (25 deterministic rules)")
  .option("--json", "output raw JSON", false)
  .action(async (id: string, opts: { json: boolean }) => {
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      process.stderr.write(`${kleur.red("✗")} Invalid pyramid ID (must be UUID)\n`);
      process.exit(1);
    }

    process.stdout.write(`${kleur.dim("→")} Validating pyramid ${kleur.bold(id)}…\n`);

    try {
      const result = (await trpc<{
        pyramidId: string;
        passed: boolean;
        issues: { rule_id: string; description: string; severity: string; affected_node_id?: string }[];
        rulesEvaluated: number;
        rulesPassed: number;
      }>("pyramid.validate", "POST", { pyramidId: id })) as {
        pyramidId: string;
        passed: boolean;
        issues: { rule_id: string; description: string; severity: string; affected_node_id?: string }[];
        rulesEvaluated: number;
        rulesPassed: number;
      };

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      const statusLine = result.passed
        ? `${kleur.green("✓ PASSED")} — ${result.rulesPassed}/${result.rulesEvaluated} rules`
        : `${kleur.red("✗ FAILED")} — ${result.rulesEvaluated - result.rulesPassed} issue(s) in ${result.rulesEvaluated} rules`;
      process.stdout.write(`${statusLine}\n`);

      for (const issue of result.issues) {
        const sev =
          issue.severity === "error"
            ? kleur.red("[error]  ")
            : issue.severity === "warning"
              ? kleur.yellow("[warn]   ")
              : kleur.dim("[info]   ");
        process.stdout.write(
          `  ${sev}${kleur.bold(issue.rule_id)} ${issue.description}\n`,
        );
        if (issue.affected_node_id) {
          process.stdout.write(
            `           ${kleur.dim("node:")} ${issue.affected_node_id}\n`,
          );
        }
      }

      if (!result.passed) process.exit(1);
    } catch (err) {
      process.stderr.write(`${kleur.red("✗")} ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ── pyramid show ──────────────────────────────────────────────────────────────

pyramidCommand
  .command("show <id>")
  .description("display a pyramid summary")
  .option("--json", "output raw JSON", false)
  .action(async (id: string, opts: { json: boolean }) => {
    try {
      const result = await trpc<unknown>("pyramid.get", "GET", { id });

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      if (!result) {
        process.stderr.write(`${kleur.red("✗")} Pyramid not found: ${id}\n`);
        process.exit(1);
      }
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (err) {
      process.stderr.write(`${kleur.red("✗")} ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

