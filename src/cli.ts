#!/usr/bin/env node
import { warnIfNonDefaultApiServer } from "./config.js";
import { handleError } from "./errors.js";
import { createLogger } from "./log.js";
import { buildProgram } from "./program.js";

// Exit cleanly when the downstream pipe consumer dies (e.g. `quire … | head`).
// Without this, the next stdout.write throws an unhandled EPIPE and Node
// crashes loudly with a stack trace — bad UX for a CLI built to compose with
// shell pipelines (Phase 6 stdout discipline).
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

const program = buildProgram();

async function main(): Promise<void> {
  warnIfNonDefaultApiServer();
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const log = createLogger({
    verbose: program.opts().verbose === true,
    color: program.opts().colorMode as "always" | "never" | "auto" | undefined,
  });
  handleError(err, log);
});
