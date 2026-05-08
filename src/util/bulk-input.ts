import { ValidationError } from "../errors.js";
import { readBytesWithLimit } from "./read-sized.js";

// Cap bulk-input files at 25 MiB. A 300-task bulk payload (the server's
// per-call ceiling) fits comfortably in well under 1 MiB; 25 MiB is the
// "you almost certainly aimed at the wrong file" line.
const MAX_BULK_BYTES = 25 * 1024 * 1024;

/**
 * Read text from a file path or stdin (`-`). Used by the bulk subcommands
 * so users can either point at a file or pipe `jq` output directly.
 */
export async function readFromFile(filename: string): Promise<string> {
  const bytes = await readBytesWithLimit(filename, MAX_BULK_BYTES, "--from-file input");
  return bytes.toString("utf8");
}

/**
 * Parse an `--from-file` source as a JSON array of objects (for `bulk-create`
 * / `bulk-update` payloads). Each element must be an object — primitives are
 * rejected with a clear `ValidationError`.
 */
export async function readBulkItems(filename: string): Promise<Record<string, unknown>[]> {
  const text = await readFromFile(filename);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ValidationError(`Failed to parse JSON from "${filename}": ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new ValidationError(`Expected a JSON array in "${filename}".`);
  }
  for (const [i, item] of parsed.entries()) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError(`Element ${i} in "${filename}" is not an object.`);
    }
  }
  return parsed as Record<string, unknown>[];
}

/**
 * Parse an `--from-file` source as a list of task refs (OIDs or numeric
 * IDs). Two accepted formats:
 *
 *   - JSON array (file starts with `[`): `["abc", 408, "def"]`
 *   - one ref per line (default): blank lines and lines starting with `#`
 *     are skipped so users can leave inline notes
 *
 * Numeric strings are coerced to numbers so the api-client's
 * `string | number` ref type lines up cleanly.
 */
export async function readBulkRefs(filename: string): Promise<Array<string | number>> {
  const text = await readFromFile(filename);
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new ValidationError(`Failed to parse JSON from "${filename}": ${(err as Error).message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new ValidationError(`Expected a JSON array of refs in "${filename}".`);
    }
    return parsed.map((v, i) => {
      if (typeof v === "string" || typeof v === "number") return v;
      throw new ValidationError(`Element ${i} in "${filename}" is not a string or number.`);
    });
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => (/^\d+$/.test(line) ? Number.parseInt(line, 10) : line));
}
