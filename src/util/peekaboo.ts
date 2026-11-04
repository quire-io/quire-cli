import { ValidationError } from "../errors.js";

/**
 * Parse the peekaboo (hide) times that `task create` / `subtask` / `update
 * --peekaboo` and `task peekaboo --days` / `--reshow-at` take. Since the
 * Nov 3 2026 server release Quire takes the same values on create and update:
 * `true` hides a task indefinitely, a whole number up to 10000 for that many
 * days, a larger one until then in ms since the epoch, and a date/time string
 * until then, a date only being 6 AM that day in the user's time zone.
 */

const MAX_DAYS = 10000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const WHOLE = /^\d+$/;

/** A whole number of days, 1 to 10000. */
export function parsePeekabooDays(input: string, flag: string): number {
  const n = WHOLE.test(input) ? Number(input) : Number.NaN;
  if (!(n >= 1 && n <= MAX_DAYS)) {
    throw new ValidationError(`${flag} must be a whole number of days from 1 to ${MAX_DAYS}; got "${input}"`);
  }
  return n;
}

/**
 * A reshow time. A date only goes to Quire as is, so that Quire reads it as
 * 6 AM in the user's time zone, which this machine doesn't know. A date and
 * time becomes ms since the epoch, in this machine's time zone when it names
 * none, as `Date.parse` reads it.
 */
export function parsePeekabooReshowAt(input: string, flag: string): number | string {
  const ms = Date.parse(input);
  if (Number.isNaN(ms)) {
    throw new ValidationError(`${flag} must be a date (2026-11-10) or an ISO 8601 date and time (2026-11-10T09:30:00Z); got "${input}"`);
  }
  // A date only is past, whatever the user's time zone, once the day is over in UTC.
  const past = DATE_ONLY.test(input) ? ms + DAY_MS <= Date.now() : ms <= Date.now();
  if (past) {
    throw new ValidationError(`${flag} must be in the future; got "${input}"`);
  }
  return DATE_ONLY.test(input) ? input : ms;
}

/**
 * `--peekaboo [when]`: with no value, hide indefinitely; a whole number is
 * days, anything else a reshow time.
 */
export function parsePeekaboo(input: string | true, flag: string): true | number | string {
  if (input === true) return true;
  return WHOLE.test(input) ? parsePeekabooDays(input, flag) : parsePeekabooReshowAt(input, flag);
}
