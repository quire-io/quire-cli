#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { handleError } from "./errors.js";
import { createLogger } from "./log.js";

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

// Subcommands land in Phases 3+. This help footer keeps `quire --help` useful in the meantime.
program.addHelpText(
  "after",
  `
Common commands (planned, not yet wired up):
  quire login              One-time OAuth setup
  quire whoami             Show the signed-in user
  quire project list       List projects you can see
  quire task list <proj>   List tasks in a project
  quire task get <id>      Show a single task

This CLI is pre-release; see PLAN.md for the build roadmap.
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
