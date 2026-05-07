import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { printTable } from "../../../src/output/table.js";

describe("printTable", () => {
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

  it("emits nothing for an empty list", () => {
    printTable([], [{ header: "X", get: () => "y" }]);
    expect(writes).toEqual([]);
  });

  it("aligns columns to the widest cell + header", () => {
    printTable(
      [
        { id: "1", name: "alpha" },
        { id: "23", name: "bravo-charlie" },
      ],
      [
        { header: "ID", get: (r) => r.id },
        { header: "NAME", get: (r) => r.name },
      ],
    );
    expect(writes.join("")).toBe(
      [
        "ID  NAME",
        "1   alpha",
        "23  bravo-charlie",
        "",
      ].join("\n"),
    );
  });

  it("truncates per-cell values longer than the default 80-char ceiling", () => {
    const long = "x".repeat(120);
    printTable([{ v: long }], [{ header: "V", get: (r) => r.v }]);
    const lines = writes.join("").split("\n");
    expect(lines[1]).toMatch(/x{79}…$/);
  });

  it("respects --no-truncate", () => {
    const long = "x".repeat(120);
    printTable([{ v: long }], [{ header: "V", get: (r) => r.v }], { noTruncate: true });
    const lines = writes.join("").split("\n");
    expect(lines[1]).toBe(long);
  });

  it("applies maxCellWidth override", () => {
    printTable(
      [{ v: "abcdefgh" }],
      [{ header: "V", get: (r) => r.v }],
      { maxCellWidth: 5 },
    );
    expect(writes.join("")).toContain("abcd…");
  });
});
