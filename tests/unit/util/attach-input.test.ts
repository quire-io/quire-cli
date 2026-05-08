import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveAttachInput } from "../../../src/util/attach-input.js";

describe("resolveAttachInput", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "quire-attach-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads bytes from a path and derives filename + content-type from the extension", async () => {
    const path = join(dir, "report.pdf");
    writeFileSync(path, Buffer.from([0x25, 0x50, 0x44, 0x46])); // %PDF
    const r = await resolveAttachInput(path);
    expect(r.filename).toBe("report.pdf");
    expect(r.contentType).toBe("application/pdf");
    expect(Buffer.from(r.bytes).toString("hex")).toBe("25504446");
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    const path = join(dir, "snapshot.bin");
    writeFileSync(path, "x");
    const r = await resolveAttachInput(path);
    expect(r.contentType).toBe("application/octet-stream");
  });

  it("honors --filename and --content-type overrides", async () => {
    const path = join(dir, "blob.dat");
    writeFileSync(path, "x");
    const r = await resolveAttachInput(path, { filename: "renamed.txt", contentType: "text/x-custom" });
    expect(r.filename).toBe("renamed.txt");
    expect(r.contentType).toBe("text/x-custom");
  });

  it("rejects filenames containing '/'", async () => {
    const path = join(dir, "ok.txt");
    writeFileSync(path, "x");
    await expect(
      resolveAttachInput(path, { filename: "sub/dir/file.txt" }),
    ).rejects.toThrow(/disallowed character "\/"/);
  });

  it("rejects filenames containing backslash (Windows path separator)", async () => {
    const path = join(dir, "ok.txt");
    writeFileSync(path, "x");
    await expect(
      resolveAttachInput(path, { filename: "sub\\dir\\file.txt" }),
    ).rejects.toThrow(/disallowed character "\\"/);
  });

  it("rejects filenames containing a NUL byte", async () => {
    const path = join(dir, "ok.txt");
    writeFileSync(path, "x");
    await expect(
      resolveAttachInput(path, { filename: "evil\x00.txt" }),
    ).rejects.toThrow(/disallowed character "\\x00"/);
  });

  it("rejects filenames containing other ASCII control characters", async () => {
    const path = join(dir, "ok.txt");
    writeFileSync(path, "x");
    await expect(
      resolveAttachInput(path, { filename: "a\nb.txt" }),
    ).rejects.toThrow(/disallowed character "\\x0a"/);
  });

  it("rejects '.' and '..' as filenames", async () => {
    const path = join(dir, "ok.txt");
    writeFileSync(path, "x");
    await expect(resolveAttachInput(path, { filename: "." })).rejects.toThrow(
      /not allowed/,
    );
    await expect(resolveAttachInput(path, { filename: ".." })).rejects.toThrow(
      /not allowed/,
    );
  });

  it("requires --filename when reading from stdin", async () => {
    await expect(resolveAttachInput("-")).rejects.toThrow(/--filename is required/);
  });
});
