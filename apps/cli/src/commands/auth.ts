import { Command } from "commander";
import kleur from "kleur";

export const authCommand = new Command("auth")
  .description("authentication and tenant management");

authCommand
  .command("login")
  .description("log in via OAuth or magic link")
  .action(() => {
    process.stderr.write(kleur.yellow("auth login: scaffold (M1 S2)\n"));
    process.exit(2);
  });

authCommand
  .command("logout")
  .description("log out and clear local credentials")
  .action(() => {
    process.stderr.write(kleur.yellow("auth logout: scaffold (M1 S2)\n"));
    process.exit(2);
  });

authCommand
  .command("whoami")
  .description("print current user and tenant")
  .action(() => {
    process.stderr.write(kleur.yellow("auth whoami: scaffold (M1 S2)\n"));
    process.exit(2);
  });
