import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { printKeyValue } from "../../../src/output/keyvalue.js";

describe("printKeyValue", () => {
  let writes: string[];

  beforeEach(() => {
    writes = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits nothing when every field is missing/empty", () => {
    printKeyValue(
      {},
      [
        { label: "Name", get: () => undefined },
        { label: "Email", get: () => "" },
        { label: "Note", get: () => null },
      ],
    );
    expect(writes).toEqual([]);
  });

  it("aligns labels to the widest filled label", () => {
    printKeyValue(
      { name: "Alice", email: "a@x.io" },
      [
        { label: "Name", get: (r: { name: string }) => r.name },
        { label: "Email", get: (r: { email: string }) => r.email },
      ],
    );
    expect(writes.join("")).toBe("Name   Alice\nEmail  a@x.io\n");
  });

  it("skips fields whose value is undefined / null / empty", () => {
    printKeyValue(
      { name: "Alice", email: "" },
      [
        { label: "Name", get: (r: { name: string }) => r.name },
        { label: "Email", get: (r: { email: string }) => r.email },
        { label: "Phone", get: () => undefined },
      ],
    );
    expect(writes.join("")).toBe("Name  Alice\n");
  });
});
