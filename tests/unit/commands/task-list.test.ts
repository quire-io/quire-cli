import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

import { registerTaskCommand } from "../../../src/commands/task.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);

describe("quire task list / subtasks --status", () => {
  let listTasks: ReturnType<typeof vi.fn>;
  let listSubtasks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listTasks = vi.fn().mockResolvedValue([]);
    listSubtasks = vi.fn().mockResolvedValue([]);
    mockedResolveTask.mockResolvedValue("t1");
    mockedFactory.mockReturnValue({
      listTasks, listSubtasks, resolveProjectOid: vi.fn().mockResolvedValue("p1"),
    } as never);
    captureStdout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(argv: string[]): Promise<void> {
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", ...argv]);
  }

  it("omits status when the flag is not given", async () => {
    await run(["task", "list", "alpha"]);
    expect(listTasks).toHaveBeenCalledWith("p1", { limit: undefined, cursor: undefined });
  });

  it("passes 'active' / 'completed' through as given", async () => {
    await run(["task", "list", "alpha", "--status", "completed"]);
    expect(listTasks).toHaveBeenCalledWith("p1", { limit: undefined, cursor: undefined, status: "completed" });
  });

  it("sends a status value as a number", async () => {
    await run(["task", "subtasks", "alpha/#1", "--status", "50"]);
    expect(listSubtasks).toHaveBeenCalledWith("t1", { limit: undefined, cursor: undefined, status: 50 });
  });

  it.each(["101", "-1", "1.5", "done"])("rejects --status %s", async (status) => {
    await expect(run(["task", "list", "alpha", "--status", status])).rejects.toThrowError(
      /--status must be 'active', 'completed', or an integer 0-100/,
    );
    expect(listTasks).not.toHaveBeenCalled();
  });
});
