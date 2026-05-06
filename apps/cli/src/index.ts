#!/usr/bin/env bun
/**
 * `egide` CLI — first-class interface alongside the web UI (cf. ADR 013).
 *
 * Every action available in the web also runs here:
 *   egide pyramid generate / validate
 *   egide compile rego / test
 *   egide approval list / show / approve / reject
 *   egide ontology reindex
 *   egide auth login / logout / whoami
 *
 * Status: scaffold. Subcommands wired ; logic stubs land progressively.
 */

import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { pyramidCommand } from "./commands/pyramid.js";
import { compileCommand } from "./commands/compile.js";
import { approvalCommand } from "./commands/approval.js";
import { pingCommand } from "./commands/ping.js";

const VERSION = "0.0.1";

const program = new Command();

program
  .name("egide")
  .description("Egide — sovereign GRC, CLI first-class")
  .version(VERSION, "-v, --version", "print version")
  .option(
    "--api <url>",
    "API endpoint",
    process.env.EGIDE_API_URL ?? "http://localhost:3001",
  )
  .option(
    "--token <token>",
    "API token (env EGIDE_API_TOKEN)",
    process.env.EGIDE_API_TOKEN,
  )
  .option("--no-color", "disable colored output")
  .option("--json", "output JSON instead of human-readable text");

program.addCommand(authCommand);
program.addCommand(pingCommand);
program.addCommand(pyramidCommand);
program.addCommand(compileCommand);
program.addCommand(approvalCommand);

program.parseAsync(Bun.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
});
