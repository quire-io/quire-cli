import { QuireAuthRevokedError } from "@quire-io/api-client";

import type { Logger } from "./log.js";

// Exit codes — see PLAN.md Phase 6.
export const ExitCode = {
  Success: 0,
  NotLoggedIn: 1,
  ApiError: 2,
  Validation: 3,
  UserDeclined: 4,
  Usage: 64,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export class CliError extends Error {
  readonly exitCode: ExitCodeValue;
  constructor(message: string, exitCode: ExitCodeValue = ExitCode.ApiError) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export class NotLoggedInError extends CliError {
  constructor(message = "Not logged in. Run `quire login`.") {
    super(message, ExitCode.NotLoggedIn);
    this.name = "NotLoggedInError";
  }
}

export class ValidationError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.Validation);
    this.name = "ValidationError";
  }
}

export class UserDeclinedError extends CliError {
  constructor(message = "Aborted by user.") {
    super(message, ExitCode.UserDeclined);
    this.name = "UserDeclinedError";
  }
}

export function handleError(err: unknown, log: Logger): never {
  if (err instanceof QuireAuthRevokedError) {
    // Refresh token is dead — `createQuireClient`'s onAuthRevoked has
    // already wiped the credentials file. Surface a clean login prompt.
    log.error("Your Quire credentials are no longer valid. Run `quire login` to re-authenticate.");
    process.exit(ExitCode.NotLoggedIn);
  }
  if (err instanceof CliError) {
    log.error(err.message);
    process.exit(err.exitCode);
  }
  if (err instanceof Error) {
    log.error(err.message);
    if (err.stack) log.debug(err.stack);
    process.exit(ExitCode.ApiError);
  }
  log.error(String(err));
  process.exit(ExitCode.ApiError);
}
