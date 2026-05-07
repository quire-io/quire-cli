import { readFileSync } from "node:fs";

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
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  if (value.startsWith("@")) {
    return readFileSync(value.slice(1), "utf8");
  }
  return value;
}
