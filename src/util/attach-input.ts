import { basename } from "node:path";

import { ValidationError } from "../errors.js";
import { readBytesWithLimit } from "./read-sized.js";

// Cap attachments at 100 MiB. The Quire server enforces its own ceiling
// further down the stack; this is a sanity check so an accidental
// `attach <id> /var/log/system.log` fails fast instead of OOMing the CLI.
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

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
  if (path === "-" && opts.filename === undefined) {
    throw new ValidationError("--filename is required when reading attachment data from stdin (`-`).");
  }
  const bytes = await readBytesWithLimit(path, MAX_ATTACHMENT_BYTES, "Attachment");
  const filename = path === "-"
    ? (opts.filename as string)
    : opts.filename ?? basename(path);

  validateFilename(filename);

  const contentType = opts.contentType ?? guessContentType(filename);
  return { filename, bytes, contentType };
}

// Reject a filename before we send it to the server. Defense-in-depth on
// top of whatever the server itself validates: catch the obvious
// path-traversal / control-char shapes here so failures surface as a
// clean ValidationError instead of a confusing 4xx round-trip.
function validateFilename(filename: string): void {
  if (filename.length === 0) {
    throw new ValidationError("Attachment filename cannot be empty.");
  }
  if (filename === "." || filename === "..") {
    throw new ValidationError(`Attachment filename "${filename}" is not allowed.`);
  }
  // Path separators (POSIX `/`, Windows `\`) and ASCII control characters
  // (0x00–0x1f, including NUL — null bytes are a string-truncation classic
  // for downstream C-based consumers).
  const bad = filename.match(/[\x00-\x1f/\\]/);
  if (bad) {
    const ch = bad[0] as string;
    const code = ch.charCodeAt(0);
    const display = code < 0x20 ? `\\x${code.toString(16).padStart(2, "0")}` : ch;
    throw new ValidationError(
      `Attachment filename contains a disallowed character "${display}" — got "${filename}".`,
    );
  }
}

function guessContentType(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  const ext = filename.slice(dot).toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}
