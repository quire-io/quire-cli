import { createInterface } from "node:readline/promises";

import { UserDeclinedError } from "../errors.js";

export interface ConfirmOptions {
  /** The yes/no question to ask. The "[y/N]" suffix is appended automatically. */
  question: string;
  /** When true, skip the prompt and proceed silently (the `--yes` flag). */
  yes?: boolean;
}

/**
 * Block until the user explicitly confirms a destructive operation. Throws
 * `UserDeclinedError` (exit 4) when:
 *
 *   - the user types anything other than `y` / `yes` (case-insensitive)
 *   - stdin is not a TTY and `--yes` was not passed (so a script can't
 *     accidentally trigger a destructive action by piping past a stuck prompt)
 *
 * The prompt is written to stderr — stdout is reserved for command output
 * (Phase 6 stdout discipline).
 */
export async function confirmDestructive(opts: ConfirmOptions): Promise<void> {
  if (opts.yes === true) return;

  if (!process.stdin.isTTY) {
    throw new UserDeclinedError(
      "Refusing to run a destructive command in a non-interactive shell. Pass --yes to confirm.",
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${opts.question} [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) {
      throw new UserDeclinedError("Aborted by user.");
    }
  } finally {
    rl.close();
  }
}
