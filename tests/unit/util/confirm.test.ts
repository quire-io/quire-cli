import { afterEach, describe, expect, it, vi } from "vitest";

import { UserDeclinedError } from "../../../src/errors.js";
import { confirmDestructive } from "../../../src/util/confirm.js";

describe("confirmDestructive", () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
    vi.restoreAllMocks();
  });

  it("returns silently when --yes is set", async () => {
    await expect(confirmDestructive({ question: "Sure?", yes: true })).resolves.toBeUndefined();
  });

  it("throws UserDeclinedError when stdin is not a TTY and --yes is not set", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    await expect(confirmDestructive({ question: "Sure?" })).rejects.toBeInstanceOf(UserDeclinedError);
  });

  it("throws UserDeclinedError carrying a non-zero exit code", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    await expect(confirmDestructive({ question: "Sure?" })).rejects.toMatchObject({
      exitCode: 4,
      name: "UserDeclinedError",
    });
  });

  // The interactive y/N prompt path needs a fake `readline` interface and
  // is exercised by the live CLI smoke test (`task delete <oid>` without
  // --yes in a TTY); skipping at the unit layer keeps these tests
  // deterministic.
});
