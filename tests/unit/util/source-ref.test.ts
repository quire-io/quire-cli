import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveSourceRef } from "../../../src/util/source-ref.js";

describe("resolveSourceRef", () => {
  it("parses a JSON object and keeps its key order", async () => {
    const ref = await resolveSourceRef('{"text":"From [issue 42](https://example.com/42)","github":{"issue":42}}');
    expect(ref).toEqual({ text: "From [issue 42](https://example.com/42)", github: { issue: 42 } });
    expect(Object.keys(ref)).toEqual(["text", "github"]);
  });

  it("reads the object from a file with @", async () => {
    const dir = mkdtempSync(join(tmpdir(), "quire-cli-test-"));
    const path = join(dir, "ref.json");
    writeFileSync(path, '{"text":"From disk"}\n', "utf8");
    expect(await resolveSourceRef(`@${path}`)).toEqual({ text: "From disk" });
  });

  it("rejects text that isn't JSON", async () => {
    await expect(resolveSourceRef("github")).rejects.toThrow(/--source-ref is not valid JSON/);
  });

  it("rejects JSON that isn't an object", async () => {
    await expect(resolveSourceRef('["a"]')).rejects.toThrow(/must be a JSON object, not an array/);
    await expect(resolveSourceRef("null")).rejects.toThrow(/must be a JSON object, not null/);
    await expect(resolveSourceRef('"text"')).rejects.toThrow(/must be a JSON object/);
  });
});
