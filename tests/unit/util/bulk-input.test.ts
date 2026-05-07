import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readBulkItems, readBulkRefs } from "../../../src/util/bulk-input.js";

function tmpFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "quire-cli-test-"));
  const path = join(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

describe("readBulkItems", () => {
  it("parses a JSON array of objects", async () => {
    const path = tmpFile("items.json", '[{"name":"a"},{"name":"b","x":1}]');
    expect(await readBulkItems(path)).toEqual([{ name: "a" }, { name: "b", x: 1 }]);
  });

  it("rejects malformed JSON", async () => {
    const path = tmpFile("items.json", "{not json");
    await expect(readBulkItems(path)).rejects.toThrowError(/Failed to parse JSON/);
  });

  it("rejects non-array root", async () => {
    const path = tmpFile("items.json", '{"name":"a"}');
    await expect(readBulkItems(path)).rejects.toThrowError(/Expected a JSON array/);
  });

  it("rejects elements that aren't plain objects", async () => {
    const path = tmpFile("items.json", '["a", "b"]');
    await expect(readBulkItems(path)).rejects.toThrowError(/not an object/);
  });
});

describe("readBulkRefs", () => {
  it("parses a JSON array with mixed string and number refs", async () => {
    const path = tmpFile("refs.json", '["abc", 408, "def"]');
    expect(await readBulkRefs(path)).toEqual(["abc", 408, "def"]);
  });

  it("rejects mixed JSON arrays containing non-string/number values", async () => {
    const path = tmpFile("refs.json", '["abc", true]');
    await expect(readBulkRefs(path)).rejects.toThrowError(/not a string or number/);
  });

  it("parses one-ref-per-line format and skips blanks/comments", async () => {
    const path = tmpFile(
      "refs.txt",
      "# header comment\n\nabc\n  def  \n# another\n408\n",
    );
    expect(await readBulkRefs(path)).toEqual(["abc", "def", 408]);
  });

  it("returns an empty list for empty file", async () => {
    const path = tmpFile("refs.txt", "   \n  \n");
    expect(await readBulkRefs(path)).toEqual([]);
  });
});
