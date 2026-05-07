#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { handleError } from "./errors.js";
import { createLogger } from "./log.js";

// Exit cleanly when the downstream pipe consumer dies (e.g. `quire … | head`).
// Without this, the next stdout.write throws an unhandled EPIPE and Node
// crashes loudly with a stack trace — bad UX for a CLI built to compose with
// shell pipelines (Phase 6 stdout discipline).
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

function readVersion(): string {
  // package.json sits one level up from dist/cli.js (built) or src/cli.ts (dev via tsx).
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

const program = new Command();

program
  .name("quire")
  .description("Command-line interface for the Quire API.")
  .version(readVersion(), "-v, --version", "Print the CLI version")
  .option("--verbose", "Enable verbose (debug) logging on stderr")
  .option("--json", "Emit raw API JSON (no human formatting)")
  .option("-q, --quiet", "Print only IDs (one per line) — designed for xargs pipelines")
  .option("--color <mode>", "Color output mode: always|never|auto", "auto")
  .option(
    "--profile <name>",
    "Use a named credential profile (default: $QUIRE_PROFILE or 'default')",
  )
  .option("--yes", "Auto-confirm destructive prompts (required for non-interactive mutating commands)");

registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);

program.addHelpText(
  "after",
  `
Auth commands:
  quire login              Sign in via OAuth (loopback + PKCE)
  quire logout             Remove the local credentials file
  quire whoami             Show the signed-in user

Read / write commands (Phase 4+) are not wired up yet — see PLAN.md.
`,
);

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const log = createLogger({
    verbose: program.opts().verbose === true,
    color: program.opts().color as "always" | "never" | "auto" | undefined,
  });
  handleError(err, log);
});
