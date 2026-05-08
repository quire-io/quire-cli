import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteCredentials,
  readCredentials,
  writeCredentials,
} from "../../src/credentials.js";

const sample = {
  accessToken: "access-abc",
  refreshToken: "refresh-xyz",
  expiresAt: 4_102_444_800_000, // 2100-01-01
  userOid: "u-1",
};

describe("credentials storage", () => {
  let dir: string;
  let prevConfigHome: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "quire-creds-"));
    prevConfigHome = process.env.QUIRE_CONFIG_HOME;
    process.env.QUIRE_CONFIG_HOME = dir;
  });

  afterEach(() => {
    if (prevConfigHome === undefined) delete process.env.QUIRE_CONFIG_HOME;
    else process.env.QUIRE_CONFIG_HOME = prevConfigHome;
    rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips: write then read returns the same credentials", () => {
    writeCredentials(sample);
    expect(readCredentials()).toEqual(sample);
  });

  it("writes a versioned encrypted envelope, not plain JSON", () => {
    writeCredentials(sample);
    const onDisk = JSON.parse(readFileSync(join(dir, "credentials.json"), "utf8"));
    // Encrypted shape — never the raw token fields.
    expect(onDisk).toHaveProperty("v", 1);
    expect(onDisk).toHaveProperty("iv");
    expect(onDisk).toHaveProperty("tag");
    expect(onDisk).toHaveProperty("ciphertext");
    expect(onDisk).not.toHaveProperty("accessToken");
    expect(onDisk).not.toHaveProperty("refreshToken");
    // The token strings must not be visible anywhere in the file.
    const raw = readFileSync(join(dir, "credentials.json"), "utf8");
    expect(raw).not.toContain(sample.accessToken);
    expect(raw).not.toContain(sample.refreshToken);
  });

  it("returns null when no credentials file exists", () => {
    expect(readCredentials()).toBeNull();
  });

  it("returns null when the envelope is corrupted (auth-tag mismatch)", () => {
    writeCredentials(sample);
    const path = join(dir, "credentials.json");
    const env = JSON.parse(readFileSync(path, "utf8"));
    // Flip a byte of ciphertext: GCM auth tag should reject on decrypt.
    const buf = Buffer.from(env.ciphertext, "base64");
    buf[0] ^= 0x01;
    env.ciphertext = buf.toString("base64");
    writeFileSync(path, JSON.stringify(env));
    expect(readCredentials()).toBeNull();
  });

  it("reads legacy plain-JSON credentials (pre-encryption) for backwards compat", () => {
    const path = join(dir, "credentials.json");
    writeFileSync(path, JSON.stringify(sample));
    expect(readCredentials()).toEqual(sample);
  });

  it("a write after a legacy read upgrades the file to the encrypted envelope", () => {
    const path = join(dir, "credentials.json");
    writeFileSync(path, JSON.stringify(sample));
    const creds = readCredentials();
    expect(creds).toEqual(sample);
    writeCredentials(creds!);
    const after = JSON.parse(readFileSync(path, "utf8"));
    expect(after).toHaveProperty("v", 1);
    expect(after).not.toHaveProperty("accessToken");
  });

  it("delete removes the file", () => {
    writeCredentials(sample);
    deleteCredentials();
    expect(readCredentials()).toBeNull();
  });

  it("named profiles use a separate file", () => {
    writeCredentials(sample, "work");
    writeCredentials({ ...sample, accessToken: "personal" }, "personal");
    expect(readCredentials("work")).toEqual(sample);
    expect(readCredentials("personal")).toEqual({ ...sample, accessToken: "personal" });
    expect(readCredentials()).toBeNull(); // no default profile written
  });
});
