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
const RESHOW = "2099-01-02T03:04:05Z";

describe("task --peekaboo / task peekaboo", () => {
  let updateTask: ReturnType<typeof vi.fn>;
  let createTask: ReturnType<typeof vi.fn>;
  let createSubtask: ReturnType<typeof vi.fn>;
  let createTaskRelative: ReturnType<typeof vi.fn>;
  let resolveProjectOid: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateTask = vi.fn().mockResolvedValue(task);
    createTask = vi.fn().mockResolvedValue(task);
    createSubtask = vi.fn().mockResolvedValue(task);
    createTaskRelative = vi.fn().mockResolvedValue(task);
    resolveProjectOid = vi.fn().mockResolvedValue("p1");
    mockedResolveTask.mockResolvedValue("t1");
    mockedFactory.mockReturnValue({
      updateTask, createTask, createSubtask, createTaskRelative, resolveProjectOid,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(argv: string[]): Promise<void> {
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", ...argv]);
  }

  it("create --peekaboo with no value hides the new task indefinitely", async () => {
    captureStdout();
    await run(["task", "create", "alpha", "--name", "x", "--peekaboo"]);
    expect(createTask).toHaveBeenCalledWith("p1", { name: "x", followers: ["me"], peekaboo: true });
  });

  it("create --sibling --peekaboo <days> sends the days through createTaskRelative", async () => {
    captureStdout();
    await run(["task", "create", "alpha", "--name", "x", "--sibling", "#7", "--position", "after", "--peekaboo", "7"]);
    expect(createTaskRelative).toHaveBeenCalledWith("t1", { name: "x", followers: ["me"], peekaboo: 7 }, "after");
  });

  it("subtask --peekaboo <date> sends the date as is", async () => {
    captureStdout();
    await run(["task", "subtask", "#7", "--name", "x", "--peekaboo", "2099-01-02"]);
    expect(createSubtask).toHaveBeenCalledWith("t1", { name: "x", followers: ["me"], peekaboo: "2099-01-02" });
  });

  it("subtask rejects a bad --peekaboo before resolving the parent", async () => {
    captureStdout();
    await expect(run(["task", "subtask", "#7", "--name", "x", "--peekaboo", "0"])).rejects.toThrow(
      /--peekaboo must be a whole number of days/,
    );
    expect(mockedResolveTask).not.toHaveBeenCalled();
  });

  it("update --peekaboo <date and time> sends ms since the epoch", async () => {
    captureStdout();
    await run(["task", "update", "t1", "--peekaboo", RESHOW]);
    expect(updateTask).toHaveBeenCalledWith("t1", { peekaboo: Date.parse(RESHOW) });
  });

  it("update --peekaboo false shows the task again", async () => {
    captureStdout();
    await run(["task", "update", "t1", "--peekaboo", "false"]);
    expect(updateTask).toHaveBeenCalledWith("t1", { peekaboo: false });
  });

  it("task peekaboo hides indefinitely, for --days, until --reshow-at, or --show un-hides", async () => {
    captureStdout();
    await run(["task", "peekaboo", "t1"]);
    expect(updateTask).toHaveBeenLastCalledWith("t1", { peekaboo: true });
    await run(["task", "peekaboo", "t1", "--days", "30"]);
    expect(updateTask).toHaveBeenLastCalledWith("t1", { peekaboo: 30 });
    await run(["task", "peekaboo", "t1", "--reshow-at", "2099-01-02"]);
    expect(updateTask).toHaveBeenLastCalledWith("t1", { peekaboo: "2099-01-02" });
    await run(["task", "peekaboo", "t1", "--reshow-at", RESHOW]);
    expect(updateTask).toHaveBeenLastCalledWith("t1", { peekaboo: Date.parse(RESHOW) });
    await run(["task", "peekaboo", "t1", "--show"]);
    expect(updateTask).toHaveBeenLastCalledWith("t1", { peekaboo: false });
  });

  it("task peekaboo takes one of --days, --reshow-at and --show", async () => {
    captureStdout();
    await expect(run(["task", "peekaboo", "t1", "--days", "3", "--show"])).rejects.toThrow(
      /--days, --show are mutually exclusive/,
    );
    await expect(run(["task", "peekaboo", "t1", "--days", "3", "--reshow-at", RESHOW])).rejects.toThrow(
      /--days, --reshow-at are mutually exclusive/,
    );
    await expect(run(["task", "peekaboo", "t1", "--days", "3.5"])).rejects.toThrow(/--days must be a whole number/);
    expect(updateTask).not.toHaveBeenCalled();
    expect(mockedResolveTask).not.toHaveBeenCalled();
  });
});
