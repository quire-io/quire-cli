import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_VAR = "QUIRE_API_SERVER";

describe("warnIfNonDefaultApiServer", () => {
  let prev: string | undefined;
  let writes: string[];

  beforeEach(() => {
    prev = process.env[ENV_VAR];
    writes = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });
    // Re-import for each test so the per-process "have I warned" guard resets.
    vi.resetModules();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = prev;
    vi.restoreAllMocks();
  });

  it("does nothing when QUIRE_API_SERVER is unset", async () => {
    delete process.env[ENV_VAR];
    const { warnIfNonDefaultApiServer } = await import("../../src/config.js");
    warnIfNonDefaultApiServer();
    expect(writes).toEqual([]);
  });

  it("does nothing when QUIRE_API_SERVER equals the default", async () => {
    process.env[ENV_VAR] = "https://quire.io";
    const { warnIfNonDefaultApiServer } = await import("../../src/config.js");
    warnIfNonDefaultApiServer();
    expect(writes).toEqual([]);
  });

  it("warns once on stderr when set to a non-default origin", async () => {
    process.env[ENV_VAR] = "https://staging.example.com";
    const { warnIfNonDefaultApiServer } = await import("../../src/config.js");
    warnIfNonDefaultApiServer();
    expect(writes.length).toBe(1);
    expect(writes[0]).toContain("warning:");
    expect(writes[0]).toContain("https://staging.example.com");
    expect(writes[0]).toContain("QUIRE_API_SERVER");
  });

  it("dedups: a second call in the same process is a no-op", async () => {
    process.env[ENV_VAR] = "https://staging.example.com";
    const { warnIfNonDefaultApiServer } = await import("../../src/config.js");
    warnIfNonDefaultApiServer();
    warnIfNonDefaultApiServer();
    warnIfNonDefaultApiServer();
    expect(writes.length).toBe(1);
  });
});
