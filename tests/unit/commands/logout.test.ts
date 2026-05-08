import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerLogoutCommand } from "../../../src/commands/logout.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

describe("quire logout", () => {
  let dir: string;
  let prevConfigHome: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "quire-logout-"));
    prevConfigHome = process.env.QUIRE_CONFIG_HOME;
    process.env.QUIRE_CONFIG_HOME = dir;
  });

  afterEach(() => {
    if (prevConfigHome === undefined) delete process.env.QUIRE_CONFIG_HOME;
    else process.env.QUIRE_CONFIG_HOME = prevConfigHome;
    rmSync(dir, { recursive: true, force: true });
  });

  it("prints both the removal confirmation and the server-side-revoke warning", async () => {
    // Plant a credentials file so the logout path actually fires.
    writeFileSync(
      join(dir, "credentials.json"),
      JSON.stringify({
        accessToken: "a",
        refreshToken: "r",
        expiresAt: 4_102_444_800_000,
        userOid: "u",
      }),
    );

    captureStdout();
    const { output: stderr } = captureStderr();
    const program = makeRootProgram();
    registerLogoutCommand(program);
    await program.parseAsync(["node", "test", "logout"]);

    const text = stderr();
    expect(text).toContain("Logged out");
    expect(text).toContain("removed");
    // The revocation caveat must be visible — it's the whole point of #9.
    expect(text).toContain("https://quire.io/apps");
    expect(text.toLowerCase()).toContain("still valid");
  });

  it("does not warn when there were no credentials to remove", async () => {
    captureStdout();
    const { output: stderr } = captureStderr();
    const program = makeRootProgram();
    registerLogoutCommand(program);
    await program.parseAsync(["node", "test", "logout"]);

    const text = stderr();
    expect(text).toContain("already logged out");
    // No revoke prompt when nothing was logged in.
    expect(text).not.toContain("https://quire.io/apps");
  });
});
