import type { QuireRecurrence } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";

export interface RecurrenceFlags {
  recurrenceFreq?: string;
  recurrenceInterval?: string;
  recurrenceByweekday?: string;
  recurrenceUntil?: string;
}

const VALID_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;

/**
 * Build a `QuireRecurrence` object from CLI flags. Returns `undefined` when
 * none of the recurrence flags are set so the caller can omit the field
 * entirely. Throws `ValidationError` (exit 3) on bad input — matches the
 * Quire wire-shape constraints (positive integer interval, freq enum,
 * 0–6 byweekday integers).
 */
export function parseRecurrence(flags: RecurrenceFlags): QuireRecurrence | undefined {
  const anyFlag =
    flags.recurrenceFreq !== undefined ||
    flags.recurrenceInterval !== undefined ||
    flags.recurrenceByweekday !== undefined ||
    flags.recurrenceUntil !== undefined;
  if (!anyFlag) return undefined;

  const freq = flags.recurrenceFreq?.toLowerCase();
  if (!freq || !(VALID_FREQS as readonly string[]).includes(freq)) {
    throw new ValidationError(
      `--recurrence-freq is required when any other --recurrence-* flag is set, and must be one of ${VALID_FREQS.join(" | ")}; got "${flags.recurrenceFreq ?? ""}"`,
    );
  }

  if (flags.recurrenceInterval === undefined) {
    throw new ValidationError("--recurrence-interval is required when any other --recurrence-* flag is set.");
  }
  const interval = Number.parseInt(flags.recurrenceInterval, 10);
  if (!Number.isInteger(interval) || interval <= 0) {
    throw new ValidationError(`--recurrence-interval must be a positive integer; got "${flags.recurrenceInterval}"`);
  }

  const recurrence: QuireRecurrence = {
    freq: freq as QuireRecurrence["freq"],
    interval,
  };

  if (flags.recurrenceByweekday !== undefined) {
    const days = flags.recurrenceByweekday
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number.parseInt(s, 10));
    if (days.length === 0) {
      throw new ValidationError(`--recurrence-byweekday must include at least one integer 0-6; got "${flags.recurrenceByweekday}"`);
    }
    for (const d of days) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw new ValidationError(`--recurrence-byweekday must be comma-separated integers 0-6; got "${flags.recurrenceByweekday}"`);
      }
    }
    recurrence.byweekday = days.length === 1 ? (days[0] as number) : days;
  }

  if (flags.recurrenceUntil !== undefined) {
    recurrence.until = flags.recurrenceUntil;
  }

  return recurrence;
}
