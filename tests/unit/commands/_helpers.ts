import { Command } from "commander";
import { vi } from "vitest";

/**
 * Build a root `Command` with the same global flags as `src/cli.ts`.
 * Each command-level test creates its own program so test runs stay
 * isolated (no shared commander state between tests).
 */
export function makeRootProgram(): Command {
  const program = new Command();
  program
    .option("--verbose")
    .option("--json")
    .option("-q, --quiet")
    .option("--color-mode <mode>", "always|never|auto", "auto")
    .option("--profile <name>")
    .option("--yes")
    .option("--no-truncate");
  return program;
}

/** Capture every chunk written to stdout. Restored automatically via vi.restoreAllMocks() in afterEach. */
export function captureStdout(): { writes: string[]; output: () => string } {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    writes.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  });
  return { writes, output: () => writes.join("") };
}

/**
 * Capture stderr output, including writes routed through the logger.
 *
 * Two paths feed stderr in our code:
 *   - `process.stderr.write(...)` direct calls (e.g. `task delete` confirmation)
 *   - `console.error(...)` via the logger in src/log.ts (e.g. `whoami` human form)
 *
 * Vitest intercepts `console.error` upstream of `process.stderr.write`, so a
 * single spy on `process.stderr` isn't enough — we capture both routes.
 */
export function captureStderr(): { writes: string[]; output: () => string } {
  const writes: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    writes.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  });
  vi.spyOn(console, "error").mockImplementation((msg: unknown, ...rest: unknown[]) => {
    const formatted = [msg, ...rest]
      .map((v) => (typeof v === "string" ? v : String(v)))
      .join(" ");
    writes.push(`${formatted}\n`);
  });
  return { writes, output: () => writes.join("") };
}
