import { readBytesWithLimit } from "./read-sized.js";

// Cap text inputs (descriptions, comments, notification messages) at
// 5 MiB. Anything bigger is almost certainly the wrong file.
const MAX_TEXT_BYTES = 5 * 1024 * 1024;

/**
 * Resolve a `--text`-style flag value into actual text. Three forms:
 *
 *   - `-`            → read all of stdin until EOF
 *   - `@/path/file`  → read the file at that path
 *   - anything else  → use as a literal string
 *
 * Mirrors how `gh` and `kubectl` handle text-input flags so users can
 * `cat long.md | quire comment add … --text -` or
 * `quire comment add … --text @notes.md` for long descriptions.
 */
export async function resolveTextInput(value: string): Promise<string> {
  if (value === "-") {
    const bytes = await readBytesWithLimit("-", MAX_TEXT_BYTES, "Text input");
    return bytes.toString("utf8");
  }
  if (value.startsWith("@")) {
    const bytes = await readBytesWithLimit(value.slice(1), MAX_TEXT_BYTES, "Text input");
    return bytes.toString("utf8");
  }
  return value;
}
