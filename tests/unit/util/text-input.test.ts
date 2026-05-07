import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveTextInput } from "../../../src/util/text-input.js";

function tmpFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "quire-cli-test-"));
  const path = join(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

describe("resolveTextInput", () => {
  it("returns a literal value unchanged", async () => {
    expect(await resolveTextInput("hello")).toBe("hello");
  });

  it("preserves multi-line literals", async () => {
    expect(await resolveTextInput("line one\nline two")).toBe("line one\nline two");
  });

  it("reads from a file when the value starts with @", async () => {
    const path = tmpFile("note.txt", "from disk\nwith newline\n");
    expect(await resolveTextInput(`@${path}`)).toBe("from disk\nwith newline\n");
  });

  it("propagates ENOENT when @file is missing", async () => {
    await expect(resolveTextInput("@/no/such/path/zzz.txt")).rejects.toThrow();
  });

  // The `-` (stdin) form is integration-tested via the CLI smoke; faking
  // the global `process.stdin` async iterator inside vitest is more
  // brittle than it's worth here.
});
