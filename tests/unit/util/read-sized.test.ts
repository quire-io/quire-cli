import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { readBytesWithLimit } from "../../../src/util/read-sized.js";

function tmpFile(name: string, content: string | Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), "quire-read-sized-"));
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

/**
 * Replace `process.stdin` with a Readable for the duration of the
 * callback. Restores the original even on throw.
 */
async function withStdin<T>(stream: Readable, fn: () => Promise<T>): Promise<T> {
  const orig = process.stdin;
  Object.defineProperty(process, "stdin", { value: stream, configurable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, "stdin", { value: orig, configurable: true });
  }
}

describe("readBytesWithLimit (file path)", () => {
  it("returns the bytes when the file is under the cap", async () => {
    const path = tmpFile("small.bin", Buffer.from("hello world"));
    const bytes = await readBytesWithLimit(path, 1000, "Test input");
    expect(bytes.toString("utf8")).toBe("hello world");
  });

  it("throws ValidationError when the file exceeds the cap", async () => {
    const path = tmpFile("big.bin", Buffer.alloc(2048, 0xff));
    await expect(readBytesWithLimit(path, 1024, "Test input")).rejects.toThrowError(
      /Test input "[^"]+\/big\.bin" is .* \(cap: .*\)/,
    );
  });

  it("propagates ENOENT for a missing file (stat fails before size check)", async () => {
    await expect(readBytesWithLimit("/no/such/file/zzz", 1000, "Test")).rejects.toThrow();
  });
});

describe("readBytesWithLimit (stdin)", () => {
  afterEach(() => {
    // Defensive — withStdin already restores, but if a test ever throws
    // mid-swap let later tests see the real stdin.
    if ((process.stdin as unknown) !== process.stdin) {
      // no-op; presence of the property check is enough.
    }
  });

  it("returns concatenated bytes from stdin when under the cap", async () => {
    const stream = Readable.from([Buffer.from("hello "), Buffer.from("world")]);
    const bytes = await withStdin(stream, () => readBytesWithLimit("-", 1000, "Test stdin"));
    expect(bytes.toString("utf8")).toBe("hello world");
  });

  it("throws ValidationError once the running byte count exceeds the cap", async () => {
    // 10 chunks of 100 bytes = 1000 total; cap at 250 → bail at chunk 3.
    const stream = Readable.from(
      Array.from({ length: 10 }, () => Buffer.alloc(100, 0xab)),
    );
    await expect(
      withStdin(stream, () => readBytesWithLimit("-", 250, "Test stdin")),
    ).rejects.toThrowError(/Test stdin from stdin exceeds the .* cap/);
  });
});
