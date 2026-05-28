import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

import { registerTaskCommand } from "../../../src/commands/task.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);

describe("quire task approve --comment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const approval = { oid: "0approve000", state: "approve", approver: "u1" };

  it("forwards a companion comment with description / pinned / asUser", async () => {
    const approveTask = vi.fn().mockResolvedValue(approval);
    mockedFactory.mockReturnValue({ approveTask } as never);
    mockedResolveTask.mockResolvedValue("0task00001");

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "approve", "0task00001",
      "--state", "approve",
      "--comment", "Looks good to ship",
      "--comment-pinned",
      "--comment-as-user", "u-bot",
    ]);

    expect(approveTask).toHaveBeenCalledWith("0task00001", {
      state: "approve",
      comment: {
        description: "Looks good to ship",
        pinned: true,
        asUser: "u-bot",
      },
    });
  });

  it("omits the comment field when --comment is not passed", async () => {
    const approveTask = vi.fn().mockResolvedValue(approval);
    mockedFactory.mockReturnValue({ approveTask } as never);
    mockedResolveTask.mockResolvedValue("0task00001");

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "approve", "0task00001",
      "--state", "reject",
    ]);

    expect(approveTask).toHaveBeenCalledWith("0task00001", { state: "reject" });
  });

  it("rejects --comment-pinned without --comment", async () => {
    const approveTask = vi.fn().mockResolvedValue(approval);
    mockedFactory.mockReturnValue({ approveTask } as never);
    mockedResolveTask.mockResolvedValue("0task00001");

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    program.exitOverride();
    registerTaskCommand(program);
    await expect(program.parseAsync([
      "node", "test", "task", "approve", "0task00001",
      "--state", "approve",
      "--comment-pinned",
    ])).rejects.toThrow(/--comment-pinned/);
    expect(approveTask).not.toHaveBeenCalled();
  });
});
