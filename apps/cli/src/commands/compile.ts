/**
 * compile commands — M4-M5 implementation.
 *
 * `egide compile rego --intent <id>` — compile a built-in Intent to Rego
 * `egide compile test --intent <id>` — compile + run fixtures
 * `egide compile list`               — list built-in intents from compiler
 *
 * Calls services/compiler on COMPILER_URL (default http://localhost:8003).
 * Falls back to inline mode if COMPILER_URL is unreachable.
 */
import { Command } from "commander";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import kleur from "kleur";

function compilerUrl(): string {
  return process.env.COMPILER_URL ?? "http://localhost:8003";
}

async function callCompiler<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${compilerUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`compiler ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function getCompiler<T>(path: string): Promise<T> {
  const res = await fetch(`${compilerUrl()}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`compiler ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Built-in intent list (mirror of compiler controls, for offline use) ──────

const BUILTIN_INTENTS = [
  "intent_db_backup_required",
  "intent_encryption_at_rest",
  "intent_access_logging",
  "intent_mfa_enforcement",
  "intent_network_egress_restriction",
] as const;

export const compileCommand = new Command("compile").description(
  "compile TAI Intents to policy targets",
);

// ── compile rego ──────────────────────────────────────────────────────────────

compileCommand
  .command("rego")
  .description("compile an Intent to Rego (OPA / Gatekeeper)")
  .requiredOption("--intent <id>", "intent ID (use `egide compile list` to browse)")
  .option("--output <dir>", "write .rego file to this directory", "")
  .option("--json", "output raw JSON artifact", false)
  .action(async (opts: { intent: string; output: string; json: boolean }) => {
    process.stdout.write(
      `${kleur.dim("→")} Compiling intent ${kleur.bold(opts.intent)} to Rego…\n`,
    );

    type Artifact = { intent_id: string; target: string; content: string; content_hash: string };

    try {
      const artifact = await callCompiler<Artifact>("/v1/compile", {
        intent: { id: opts.intent },
        target: "rego",
      });

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
        return;
      }

      if (opts.output) {
        mkdirSync(opts.output, { recursive: true });
        const filename = `${opts.intent}.rego`;
        const filePath = join(opts.output, filename);
        writeFileSync(filePath, artifact.content, "utf8");
        process.stdout.write(
          `${kleur.green("✓")} Written to ${kleur.bold(filePath)}\n`,
        );
        process.stdout.write(
          `${kleur.dim("  ")}hash: ${artifact.content_hash}\n`,
        );
      } else {
        // Print to stdout
        process.stdout.write(`${artifact.content}\n`);
      }
    } catch (err) {
      process.stderr.write(`${kleur.red("✗")} ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ── compile ansible ───────────────────────────────────────────────────────────

compileCommand
  .command("ansible")
  .description("compile an Intent to an Ansible playbook + Molecule scenario")
  .requiredOption("--intent <id>", "intent ID (use `egide compile list` to browse)")
  .option("--output <dir>", "write playbook + molecule/ files to this directory", "")
  .option("--json", "output raw JSON artifact + extra_files map", false)
  .action(async (opts: { intent: string; output: string; json: boolean }) => {
    process.stdout.write(
      `${kleur.dim("→")} Compiling intent ${kleur.bold(opts.intent)} to Ansible…\n`,
    );

    type Artifact = {
      intent_id: string;
      target: string;
      content: string;
      content_hash: string;
    };
    type Response = { artifact: Artifact; extra_files: Record<string, string> };

    try {
      const resp = await callCompiler<Response>("/v1/compile", {
        intent: { id: opts.intent },
        target: "ansible",
      });

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(resp, null, 2)}\n`);
        return;
      }

      if (!opts.output) {
        // Print playbook to stdout when no output dir is set.
        process.stdout.write(`${resp.artifact.content}\n`);
        return;
      }

      mkdirSync(opts.output, { recursive: true });
      const playbookPath = join(opts.output, "playbook.yml");
      writeFileSync(playbookPath, resp.artifact.content, "utf8");
      process.stdout.write(
        `${kleur.green("✓")} Written ${kleur.bold(playbookPath)}\n`,
      );

      for (const [relPath, content] of Object.entries(resp.extra_files ?? {})) {
        const target = join(opts.output, relPath);
        mkdirSync(join(target, ".."), { recursive: true });
        writeFileSync(target, content, "utf8");
        process.stdout.write(`${kleur.green("✓")} Written ${kleur.bold(target)}\n`);
      }
      process.stdout.write(
        `${kleur.dim("  ")}hash: ${resp.artifact.content_hash}\n`,
      );
      process.stdout.write(
        `${kleur.dim("→")} Run tests with: ${kleur.bold(`cd ${opts.output} && molecule test`)}\n`,
      );
    } catch (err) {
      process.stderr.write(`${kleur.red("✗")} ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ── compile test ──────────────────────────────────────────────────────────────

compileCommand
  .command("test")
  .description("compile an Intent and run its fixtures")
  .requiredOption("--intent <id>", "intent ID")
  .option("--target <target>", "compilation target", "rego")
  .option("--json", "output raw JSON", false)
  .action(async (opts: { intent: string; target: string; json: boolean }) => {
    process.stdout.write(
      `${kleur.dim("→")} Compiling + testing intent ${kleur.bold(opts.intent)} (${opts.target})…\n`,
    );

    type TestResult = { name: string; passed: boolean; expect: string; got: string; message?: string };
    type Artifact = { intent_id: string; content_hash: string; tests_passed: number; tests_total: number };
    type Response = { artifact: Artifact; results: TestResult[]; passed: boolean };

    try {
      const resp = await callCompiler<Response>("/v1/compile/test", {
        intent: { id: opts.intent },
        target: opts.target,
      });

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(resp, null, 2)}\n`);
        return;
      }

      const { artifact, results } = resp;
      const statusLine = resp.passed
        ? `${kleur.green("✓ ALL PASS")} — ${artifact.tests_passed}/${artifact.tests_total} fixtures`
        : `${kleur.red("✗ FAILURES")} — ${artifact.tests_passed}/${artifact.tests_total} fixtures passed`;
      process.stdout.write(`${statusLine}\n`);

      for (const r of results) {
        const icon = r.passed ? kleur.green("✓") : kleur.red("✗");
        process.stdout.write(`  ${icon} ${r.name}\n`);
        if (!r.passed) {
          process.stdout.write(
            `    ${kleur.dim("expected")} ${r.expect} ${kleur.dim("got")} ${r.got}${r.message ? ` — ${r.message}` : ""}\n`,
          );
        }
      }
      if (!resp.passed) process.exit(1);
    } catch (err) {
      process.stderr.write(`${kleur.red("✗")} ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ── compile list ──────────────────────────────────────────────────────────────

compileCommand
  .command("list")
  .description("list available built-in intents from the compiler service")
  .option("--json", "output raw JSON", false)
  .action(async (opts: { json: boolean }) => {
    type IntentSummary = { id: string; title: string; severity: string; version: string };
    type Response = { intents: IntentSummary[]; total: number };

    try {
      const resp = await getCompiler<Response>("/v1/intents");

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(resp, null, 2)}\n`);
        return;
      }

      if (resp.intents.length === 0) {
        process.stdout.write(`${kleur.dim("—")} No intents found\n`);
        return;
      }

      process.stdout.write(
        `${kleur.dim("ID".padEnd(42))} ${kleur.dim("SEV".padEnd(10))} ${kleur.dim("TITLE")}\n`,
      );
      for (const intent of resp.intents) {
        const sev =
          intent.severity === "error"
            ? kleur.red(intent.severity.padEnd(10))
            : intent.severity === "warning"
              ? kleur.yellow(intent.severity.padEnd(10))
              : kleur.dim(intent.severity.padEnd(10));
        process.stdout.write(
          `${kleur.dim(intent.id.padEnd(42))} ${sev} ${intent.title}\n`,
        );
      }
    } catch {
      // Offline fallback — show built-in list without descriptions
      process.stdout.write(
        `${kleur.yellow("!")} Compiler unreachable. Built-in intent IDs:\n`,
      );
      for (const id of BUILTIN_INTENTS) {
        process.stdout.write(`  ${kleur.dim("•")} ${id}\n`);
      }
    }
  });

