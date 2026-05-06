import { Command } from "commander";
import kleur from "kleur";

export const approvalCommand = new Command("approval")
  .description("manage approval requests (cf. ADR 010)");

approvalCommand
  .command("list")
  .description("list approval requests")
  .option("--status <status>", "filter (pending|approved|rejected|expired)")
  .option("--mine", "only requests assigned to me")
  .action((_opts) => {
    process.stderr.write(
      kleur.yellow("approval list: scaffold (lands with J6/J9 implementation)\n"),
    );
    process.exit(2);
  });

approvalCommand
  .command("show <id>")
  .description("show approval detail")
  .action((_id) => {
    process.stderr.write(kleur.yellow("approval show: scaffold\n"));
    process.exit(2);
  });

approvalCommand
  .command("approve <id>")
  .description("sign an approval (Ed25519)")
  .option("--comment <comment>", "approval comment")
  .action((_id, _opts) => {
    process.stderr.write(kleur.yellow("approval approve: scaffold\n"));
    process.exit(2);
  });

approvalCommand
  .command("reject <id>")
  .description("reject an approval request")
  .option("--comment <comment>", "rejection reason")
  .action((_id, _opts) => {
    process.stderr.write(kleur.yellow("approval reject: scaffold\n"));
    process.exit(2);
  });
