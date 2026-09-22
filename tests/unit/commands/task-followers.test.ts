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

const task = { oid: "t1", id: 42, name: "Ship it", nameText: "Ship it" };

describe("task follower flags", () => {
  let updateTask: ReturnType<typeof vi.fn>;
  let createTask: ReturnType<typeof vi.fn>;
  let createSubtask: ReturnType<typeof vi.fn>;
  let searchTasks: ReturnType<typeof vi.fn>;
  let resolveProjectOid: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateTask = vi.fn().mockResolvedValue(task);
    createTask = vi.fn().mockResolvedValue(task);
    createSubtask = vi.fn().mockResolvedValue(task);
    searchTasks = vi.fn().mockResolvedValue([]);
    resolveProjectOid = vi.fn().mockResolvedValue("p1");
    mockedResolveTask.mockResolvedValue("t1");
    mockedFactory.mockReturnValue({
      updateTask, createTask, createSubtask, searchTasks, resolveProjectOid,
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

  it("update sends the deltas", async () => {
    await run(["task", "update", "t1", "--add-follower", "me", "--remove-follower", "a@b.co"]);
    expect(updateTask).toHaveBeenCalledWith("t1", {
      addFollowers: ["me"],
      removeFollowers: ["a@b.co"],
    });
  });

  it("update sends a full replace for --follower", async () => {
    await run(["task", "update", "t1", "--follower", "me", "--follower", "a@b.co"]);
    expect(updateTask).toHaveBeenCalledWith("t1", { followers: ["me", "a@b.co"] });
  });

  it("update passes 'inherit' straight through", async () => {
    await run(["task", "update", "t1", "--remove-follower", "inherit"]);
    expect(updateTask).toHaveBeenCalledWith("t1", { removeFollowers: ["inherit"] });
  });

  it("update refuses a full replace combined with a delta", async () => {
    await expect(
      run(["task", "update", "t1", "--follower", "me", "--add-follower", "a@b.co"]),
    ).rejects.toThrowError(/Cannot combine --follower \(full replace\)/);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("update still sends nothing follower-shaped when no follower flag is passed", async () => {
    await run(["task", "update", "t1", "--name", "x"]);
    expect(updateTask).toHaveBeenCalledWith("t1", { name: "x" });
  });

  it("create sends followers", async () => {
    await run(["task", "create", "alpha", "--name", "x", "--follower", "me"]);
    expect(createTask).toHaveBeenCalledWith("p1", { name: "x", followers: ["me"] });
  });

  it("create --parent routes followers through createSubtask", async () => {
    await run(["task", "create", "alpha", "--name", "x", "--parent", "#7", "--follower", "inherit"]);
    expect(createSubtask).toHaveBeenCalledWith("t1", { name: "x", followers: ["inherit"] });
  });

  it("subtask sends followers", async () => {
    await run(["task", "subtask", "#7", "--name", "x", "--follower", "me"]);
    expect(createSubtask).toHaveBeenCalledWith("t1", { name: "x", followers: ["me"] });
  });

  it("search filters by follower", async () => {
    await run(["task", "search", "q", "--project", "alpha", "--follower", "me"]);
    expect(searchTasks).toHaveBeenCalledWith("p1", { text: "q", follower: "me" });
  });
});
