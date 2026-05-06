import { Command } from "commander";
import kleur from "kleur";

export const pingCommand = new Command("ping")
  .description("check API connectivity")
  .action(async () => {
    const apiUrl = process.env.EGIDE_API_URL ?? "http://localhost:3001";
    try {
      const r = await fetch(`${apiUrl}/health`);
      const body = (await r.json()) as { status: string; uptime_s: number };
      if (r.ok && body.status === "ok") {
        process.stdout.write(
          `${kleur.green("✓")} ${apiUrl} ok (uptime ${body.uptime_s}s)\n`,
        );
      } else {
        process.stderr.write(
          `${kleur.red("✗")} ${apiUrl} returned ${r.status}\n`,
        );
        process.exit(1);
      }
    } catch (err) {
      process.stderr.write(
        `${kleur.red("✗")} ${apiUrl} unreachable: ${(err as Error).message}\n`,
      );
      process.exit(1);
    }
  });
