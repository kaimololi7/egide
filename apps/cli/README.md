# @egide/cli

`egide` CLI — first-class interface alongside the web UI (cf. ADR 013).

## Status

Scaffold. Subcommands wired with help and option parsing. `egide ping`
works against a running `apps/api`. Other commands print scaffold
notice and exit 2.

## Run

```bash
# Development (Bun runtime)
pnpm --filter @egide/cli dev -- --help
pnpm --filter @egide/cli dev -- ping

# Build single binary (when ready to ship)
pnpm --filter @egide/cli build
./dist/egide --help
```

## Commands

```
egide auth login | logout | whoami
egide ping
egide pyramid generate | list | validate <id> | show <id>
egide compile rego --intent <id>
egide compile test --intent <id> --target <target>
egide compile list [--status fresh|stale|failed]
egide approval list [--mine] [--status ...]
egide approval show <id>
egide approval approve <id> [--comment ...]
egide approval reject <id> [--comment ...]
```

Global flags: `--api <url>`, `--token <token>`, `--no-color`, `--json`.

Env vars: `EGIDE_API_URL`, `EGIDE_API_TOKEN`.

## Reference

- ADR 013 — MVP persona (CLI first-class)
- ADR 015 — API versioning (CLI consumes /v1/*)
