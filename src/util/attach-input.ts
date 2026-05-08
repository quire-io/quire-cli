import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { ValidationError } from "../errors.js";

const CONTENT_TYPE_BY_EXT: Readonly<Record<string, string>> = {
  ".bmp": "image/bmp",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".log": "text/plain",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".tar": "application/x-tar",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".zip": "application/zip",
};

export interface AttachInput {
  filename: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface ResolveAttachOptions {
  /** Filename override; required when reading from stdin (`-`). */
  filename?: string;
  /** Content-Type override; falls back to extension-based guess, then `application/octet-stream`. */
  contentType?: string;
}

/**
 * Resolve a positional `<file>` argument into bytes + filename + content-type.
 *
 * `path = "-"` reads stdin to EOF; `--filename` is then required (we have no
 * path to derive it from). Otherwise the path is read with `readFileSync`
 * and the filename defaults to its `basename`.
 */
export async function resolveAttachInput(
  path: string,
  opts: ResolveAttachOptions = {},
): Promise<AttachInput> {
  let bytes: Uint8Array;
  let filename: string;

  if (path === "-") {
    if (opts.filename === undefined) {
      throw new ValidationError("--filename is required when reading attachment data from stdin (`-`).");
    }
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    bytes = Buffer.concat(chunks);
    filename = opts.filename;
  } else {
    bytes = readFileSync(path);
    filename = opts.filename ?? basename(path);
  }

  if (filename.includes("/")) {
    throw new ValidationError(`Attachment filename cannot contain "/" — got "${filename}".`);
  }
  if (filename.length === 0) {
    throw new ValidationError("Attachment filename cannot be empty.");
  }

  const contentType = opts.contentType ?? guessContentType(filename);
  return { filename, bytes, contentType };
}

function guessContentType(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  const ext = filename.slice(dot).toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}
