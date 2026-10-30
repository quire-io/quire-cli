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

// `text` first: Quire rejects as "too big" a sourceRef where a nested value
// comes before a string-valued key (Oct 30 2026).
const REF = '{"text":"From [issue 42](https://example.com/42)","github":{"issue":42}}';
const REF_OBJ = { text: "From [issue 42](https://example.com/42)", github: { issue: 42 } };

describe("task --source-ref / --partner", () => {
  let updateTask: ReturnType<typeof vi.fn>;
  let createTask: ReturnType<typeof vi.fn>;
  let createSubtask: ReturnType<typeof vi.fn>;
  let createTaskRelative: ReturnType<typeof vi.fn>;
  let searchTasks: ReturnType<typeof vi.fn>;
  let getTask: ReturnType<typeof vi.fn>;
  let resolveProjectOid: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateTask = vi.fn().mockResolvedValue(task);
    createTask = vi.fn().mockResolvedValue(task);
    createSubtask = vi.fn().mockResolvedValue(task);
    createTaskRelative = vi.fn().mockResolvedValue(task);
    searchTasks = vi.fn().mockResolvedValue([]);
    getTask = vi.fn().mockResolvedValue(task);
    resolveProjectOid = vi.fn().mockResolvedValue("p1");
    mockedResolveTask.mockResolvedValue("t1");
    mockedFactory.mockReturnValue({
      updateTask, createTask, createSubtask, createTaskRelative, searchTasks, getTask, resolveProjectOid,
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

  it("create sends the parsed sourceRef and the partner", async () => {
    captureStdout();
    await run(["task", "create", "alpha", "--name", "x", "--source-ref", REF, "--partner", "Acme"]);
    expect(createTask).toHaveBeenCalledWith("p1", {
      name: "x", followers: ["me"], partner: "Acme", sourceRef: REF_OBJ,
    });
  });

  it("create --sibling sends them through createTaskRelative", async () => {
    captureStdout();
    await run(["task", "create", "alpha", "--name", "x", "--sibling", "#7", "--position", "before", "--source-ref", REF]);
    expect(createTaskRelative).toHaveBeenCalledWith("t1", { name: "x", followers: ["me"], sourceRef: REF_OBJ }, "before");
  });

  it("subtask sends the parsed sourceRef and the partner", async () => {
    captureStdout();
    await run(["task", "subtask", "#7", "--name", "x", "--source-ref", REF, "--partner", "Acme"]);
    expect(createSubtask).toHaveBeenCalledWith("t1", {
      name: "x", followers: ["me"], partner: "Acme", sourceRef: REF_OBJ,
    });
  });

  it("create rejects a sourceRef that isn't a JSON object before calling Quire", async () => {
    captureStdout();
    await expect(run(["task", "create", "alpha", "--name", "x", "--source-ref", "[1]"])).rejects.toThrow(
      /--source-ref must be a JSON object/,
    );
    expect(createTask).not.toHaveBeenCalled();
  });

  it("update sends the sourceRef and the partner", async () => {
    captureStdout();
    await run(["task", "update", "t1", "--source-ref", REF, "--partner", "Acme"]);
    expect(updateTask).toHaveBeenCalledWith("t1", { partner: "Acme", sourceRef: REF_OBJ });
  });

  it("update sends sourceRef: null for the literal 'null'", async () => {
    captureStdout();
    await run(["task", "update", "t1", "--source-ref", "null"]);
    expect(updateTask).toHaveBeenCalledWith("t1", { sourceRef: null });
  });

  it("search filters by a sourceRef key", async () => {
    captureStdout();
    await run(["task", "search", "q", "--project", "alpha", "--source-ref", "github"]);
    expect(searchTasks).toHaveBeenCalledWith("p1", { text: "q", sourceRef: "github" });
  });

  it("get shows the partner's name and the sourceRef as stored", async () => {
    getTask.mockResolvedValue({ ...task, partner: { oid: "pt1", name: "Acme" }, sourceRef: REF_OBJ });
    const out = captureStdout();
    await run(["task", "get", "t1"]);
    expect(out.output()).toMatch(/^Partner\s+Acme$/m);
    const line = out.output().split("\n").find((l) => l.startsWith("Source ref"));
    expect(line?.replace(/^Source ref\s+/, "")).toBe(JSON.stringify(REF_OBJ));
  });

  it("get leaves both lines out when the task has neither", async () => {
    const out = captureStdout();
    await run(["task", "get", "t1"]);
    expect(out.output()).not.toMatch(/Partner|Source ref/);
  });
});
