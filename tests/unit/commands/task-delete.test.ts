import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerTaskCommand } from "../../../src/commands/task.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const originalIsTTY = process.stdin.isTTY;

describe("quire task delete", () => {
  let deleteTask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deleteTask = vi.fn().mockResolvedValue(undefined);
    mockedFactory.mockReturnValue({ deleteTask } as never);
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
    vi.restoreAllMocks();
  });

  it("deletes silently when --yes is set, with a stderr confirmation", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    captureStdout();
    const { output: stderr } = captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "--yes", "task", "delete", "0task0task0task0task0123"]);
    expect(deleteTask).toHaveBeenCalledWith("0task0task0task0task0123");
    expect(stderr()).toContain("Deleted task 0task0task0task0task0123.");
  });

  it("emits a JSON receipt with --json --yes", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "--yes", "--json", "task", "delete", "0task0task0task0task0123"]);
    expect(JSON.parse(output().trim())).toEqual({ oid: "0task0task0task0task0123", deleted: true });
  });

  it("emits OID-only with --quiet --yes", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "--yes", "--quiet", "task", "delete", "0task0task0task0task0123"]);
    expect(output()).toBe("0task0task0task0task0123\n");
  });

  it("refuses non-interactive shell without --yes (UserDeclinedError, exit 4)", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await expect(
      program.parseAsync(["node", "test", "task", "delete", "0task0task0task0task0123"]),
    ).rejects.toMatchObject({ name: "UserDeclinedError", exitCode: 4 });
    expect(deleteTask).not.toHaveBeenCalled();
  });
});
