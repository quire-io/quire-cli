/**
 * Retry-once-on-429 helper. Wraps any async function: on a Quire 429
 * "rate limited" error, parses the retry-after value from the error
 * message (set by `@quire-io/api-client`'s `formatQuireError`), waits,
 * and retries one time. Above the cap (default 60s) or when the wait
 * value is unparseable, throws a `CliError` with exit code 2.
 *
 * 429 means the server did no work, so retrying is always idempotent —
 * the wrapped function can be a single GET, a single write, or a
 * multi-step action; either way replaying it is safe.
 *
 * Implementation note: the api-client throws a plain `Error` for 4xx
 * responses, encoding the retry-after value into the message text. We
 * detect 429s by message-prefix and parse the wait value out. If the
 * api-client ever exposes a typed `QuireRateLimitedError` we'd switch
 * to that — but for now message-matching is the only API surface.
 */
import { CliError, ExitCode } from "../errors.js";

const DEFAULT_CAP_SEC = 60;
const RATE_LIMITED_PREFIX = "Quire API error 429";
// Matches "retry after 30s" / "retry after 1m 30s" / "retry after 2m"
const RETRY_AFTER_PATTERN = /retry after (?:(\d+)m\s*)?(\d+)?s?/i;

function parseRetryAfterSec(message: string): number | null {
  const m = RETRY_AFTER_PATTERN.exec(message);
  if (!m) return null;
  const minutes = m[1] ? Number.parseInt(m[1], 10) : 0;
  const seconds = m[2] ? Number.parseInt(m[2], 10) : 0;
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function isRateLimited(err: unknown): err is Error {
  return err instanceof Error && err.message.startsWith(RATE_LIMITED_PREFIX);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetryOn429<T>(
  fn: () => Promise<T>,
  opts: { capSec?: number; onRetry?: (waitSec: number) => void } = {},
): Promise<T> {
  const cap = opts.capSec ?? DEFAULT_CAP_SEC;
  try {
    return await fn();
  } catch (err) {
    if (!isRateLimited(err)) throw err;
    const waitSec = parseRetryAfterSec(err.message);
    if (waitSec === null) {
      throw new CliError(
        "Quire API rate limited; retry in 60s+ (precise wait time unavailable)",
        ExitCode.ApiError,
      );
    }
    if (waitSec > cap) {
      throw new CliError(
        `Quire API rate limited; retry in ${waitSec}s`,
        ExitCode.ApiError,
      );
    }
    opts.onRetry?.(waitSec);
    await sleep(waitSec * 1000);
    return await fn();
  }
}
