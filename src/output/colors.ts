/**
 * Display helpers for Quire's 48-slot palette. The api-client exposes
 * the canonical `COLOR_TABLE` (code → hex) and `NAMED_COLORS` (name →
 * code); this module adds the small inverse + presentation logic the
 * CLI needs.
 *
 * ANSI swatch rendering converts the hex to the closest color in the
 * 256-color cube (16 + 36·r + 6·g + b, each in 0..5). Skipped when
 * stdout is not a TTY or `NO_COLOR` is set so piped output stays clean
 * for `jq` / `grep` consumers.
 */
import { COLOR_TABLE, NAMED_COLORS } from "@quire-io/api-client";

const CODE_TO_NAME = new Map<string, string>();
for (const [name, code] of Object.entries(NAMED_COLORS)) {
  // First name registered wins — e.g. "gray" before "grey" since
  // Object.entries iterates in insertion order.
  if (!CODE_TO_NAME.has(code)) CODE_TO_NAME.set(code, name);
}

const stdoutTty = process.stdout.isTTY === true && !process.env.NO_COLOR;

function hexToAnsi256(hex: string): number {
  // hex is "#RRGGBB"
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const r6 = Math.round((r / 255) * 5);
  const g6 = Math.round((g / 255) * 5);
  const b6 = Math.round((b / 255) * 5);
  return 16 + 36 * r6 + 6 * g6 + b6;
}

/** Return a colored "●" if stdout is a TTY and the code is known; else "". */
export function ansiSwatch(code: string | undefined): string {
  if (!code || !stdoutTty) return "";
  const hex = COLOR_TABLE[code];
  if (!hex) return "";
  return `\x1b[38;5;${hexToAnsi256(hex)}m●\x1b[0m`;
}

/** Reverse-lookup: code → friendly name (or undefined). */
export function friendlyColor(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return CODE_TO_NAME.get(code);
}

/**
 * Short form for table cells: "● red" if known and TTY, "● 06" if unknown
 * but TTY, "red" if known but non-TTY, "06" otherwise. Falls back to ""
 * for missing codes.
 */
export function shortColor(code: string | undefined): string {
  if (!code) return "";
  const label = CODE_TO_NAME.get(code) ?? code;
  const swatch = ansiSwatch(code);
  return swatch ? `${swatch} ${label}` : label;
}

/**
 * Long form for `get` views: "● red (06, #D81F1E)" / "red (06, #D81F1E)" /
 * "06 (#D81F1E)" / "06" depending on what we know.
 */
export function longColor(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const name = CODE_TO_NAME.get(code);
  const hex = COLOR_TABLE[code];
  let label: string;
  if (name && hex) label = `${name} (${code}, ${hex})`;
  else if (hex) label = `${code} (${hex})`;
  else label = code;
  const swatch = ansiSwatch(code);
  return swatch ? `${swatch} ${label}` : label;
}
