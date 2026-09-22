/**
 * `--lead` parsing for `quire reminder`. A lead says how far before the fire
 * time to notify; each one produces its own notification.
 *
 * Grammar (repeat the flag for multiple leads):
 *
 *   30m       -> { minutes: 30 }   absolute offset
 *   30        -> { minutes: 30 }   bare number is minutes
 *   2d        -> { days: 2 }       calendar days
 *   2d@09:00  -> { days: 2, at: "09:00" }
 *
 * `minutes` is an absolute offset, so 30 stays 30 real minutes across a
 * daylight-saving transition; `days` counts calendar days, keeping its
 * wall-clock time across one. There is deliberately no `h` or `w` unit —
 * Quire's wire format has only these two, an hour is `60m` and a week `7d`.
 *
 * `at` is read in the timezone of the member who created the reminder, and
 * Quire accepts it only alongside `days`.
 */
import type { QuireReminderLead } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";

/** Quire caps a lead at 10,000 days out, and a reminder at 30 leads. */
const MAX_DAYS = 10_000;
const MAX_MINUTES = MAX_DAYS * 24 * 60;
const MAX_LEADS = 30;

const LEAD_RE = /^(\d+)(m|d)?(?:@(\d{1,2}):(\d{2}))?$/;

function parseLead(spec: string): QuireReminderLead {
  const m = LEAD_RE.exec(spec.trim());
  if (!m) {
    throw new ValidationError(
      `Invalid --lead "${spec}". Expected <n>m (minutes), <n>d (days), or <n>d@HH:mm — e.g. '30m', '2d', '1d@09:00'.`,
    );
  }
  const value = Number.parseInt(m[1] as string, 10);
  const unit = m[2] ?? "m";
  const hh = m[3];
  const mm = m[4];

  if (hh !== undefined && unit !== "d") {
    throw new ValidationError(
      `Invalid --lead "${spec}". The @HH:mm suffix is only valid on a day lead — e.g. '1d@09:00'.`,
    );
  }

  if (unit === "d") {
    if (value > MAX_DAYS) {
      throw new ValidationError(`--lead "${spec}" exceeds Quire's maximum of ${MAX_DAYS} days.`);
    }
    const lead: QuireReminderLead = { days: value };
    if (hh !== undefined && mm !== undefined) {
      const hours = Number.parseInt(hh, 10);
      const mins = Number.parseInt(mm, 10);
      if (hours > 23 || mins > 59) {
        throw new ValidationError(`Invalid --lead "${spec}". The time must be 24-hour HH:mm, 00:00-23:59.`);
      }
      lead.at = `${String(hours).padStart(2, "0")}:${mm}`;
    }
    return lead;
  }

  if (value > MAX_MINUTES) {
    throw new ValidationError(`--lead "${spec}" exceeds Quire's maximum of ${MAX_DAYS} days.`);
  }
  return { minutes: value };
}

/**
 * Parse every `--lead` value. Returns `undefined` when the flag was not
 * passed, so the caller can omit the field and let Quire apply its default of
 * one notification at the fire time.
 */
export function parseLeads(specs: string[] | undefined): QuireReminderLead[] | undefined {
  if (specs === undefined || specs.length === 0) return undefined;
  if (specs.length > MAX_LEADS) {
    throw new ValidationError(`A reminder carries at most ${MAX_LEADS} leads; got ${specs.length}.`);
  }
  return specs.map(parseLead);
}

/** Render a reminder's leads back in the `--lead` grammar, for `… get` output. */
export function formatLeads(leads: QuireReminderLead[] | undefined): string | undefined {
  if (leads === undefined || leads.length === 0) return undefined;
  return leads
    .map((l) => (l.days !== undefined ? `${l.days}d${l.at !== undefined ? `@${l.at}` : ""}` : `${l.minutes ?? 0}m`))
    .join(", ");
}
