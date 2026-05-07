import { ValidationError } from "../errors.js";

export interface FieldFlags {
  name?: string;
  type?: string;
  hidden?: boolean;
  private?: boolean;
  percent?: boolean;
  multiple?: boolean;
  clearOnDup?: boolean;
  /** `--extra key=value`, repeatable. Value is JSON-parsed when possible. */
  extra?: string[];
}

/**
 * Build a Quire field-definition body from CLI flags. The api-client's body
 * type for `addProjectField` / `addInsightField` etc. is `{ name, type,
 * [key: string]: unknown }`, so we let the user pass arbitrary type-specific
 * config via `--extra key=value` (JSON-parsed when possible — so
 * `--extra options='[{"label":"red"}]'` works for select-type fields).
 */
export function buildFieldBody(flags: FieldFlags): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (flags.name !== undefined) body.name = flags.name;
  if (flags.type !== undefined) body.type = flags.type;
  if (flags.hidden === true) body.hidden = true;
  if (flags.private === true) body.private = true;
  if (flags.percent === true) body.percent = true;
  if (flags.multiple === true) body.multiple = true;
  if (flags.clearOnDup === true) body.clearOnDup = true;
  if (flags.extra) {
    for (const pair of flags.extra) {
      const eq = pair.indexOf("=");
      if (eq <= 0) {
        throw new ValidationError(`Invalid --extra "${pair}". Expected key=value.`);
      }
      const key = pair.slice(0, eq);
      const raw = pair.slice(eq + 1);
      try {
        body[key] = JSON.parse(raw);
      } catch {
        body[key] = raw;
      }
    }
  }
  return body;
}

export const FIELD_FIELDS = [
  { label: "Name", get: (f: { name: string }) => f.name },
  { label: "Type", get: (f: { type: string }) => f.type },
  { label: "Hidden", get: (f: { hidden?: boolean }) => (f.hidden === true ? "yes" : undefined) },
  { label: "Private", get: (f: { private?: boolean }) => (f.private === true ? "yes" : undefined) },
  { label: "Percent", get: (f: { percent?: boolean }) => (f.percent === true ? "yes" : undefined) },
  { label: "Multiple", get: (f: { multiple?: boolean }) => (f.multiple === true ? "yes" : undefined) },
  { label: "Clear on dup", get: (f: { clearOnDup?: boolean }) => (f.clearOnDup === true ? "yes" : undefined) },
];
