import { readFileSync, statSync } from "node:fs";

import { ValidationError } from "../errors.js";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

/**
 * Read bytes from a file path (or stdin via `-`) with a hard size cap.
 * Checked against `stat().size` for files (cheap) and accumulated
 * byte-by-byte for stdin so a runaway pipe can't fill memory.
 *
 * Throws `ValidationError` (exit 3) when the input exceeds `maxBytes`.
 */
export async function readBytesWithLimit(
  path: string,
  maxBytes: number,
  label: string,
): Promise<Buffer> {
  if (path === "-") {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of process.stdin) {
      const c = chunk as Buffer;
      total += c.length;
      if (total > maxBytes) {
        throw new ValidationError(
          `${label} from stdin exceeds the ${formatSize(maxBytes)} cap.`,
        );
      }
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  }
  const size = statSync(path).size;
  if (size > maxBytes) {
    throw new ValidationError(
      `${label} "${path}" is ${formatSize(size)} (cap: ${formatSize(maxBytes)}).`,
    );
  }
  return readFileSync(path);
}
