import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

vi.mock("../../../src/util/bulk-input.js", () => ({
  readBulkItems: vi.fn(),
  readBulkRefs: vi.fn(),
}));

import { registerTaskCommand } from "../../../src/commands/task.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { readBulkItems } from "../../../src/util/bulk-input.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);
const mockedReadBulkItems = vi.mocked(readBulkItems);

describe("quire task bulk-subtasks", () => {
  const items = [{ name: "child A" }, { name: "child B" }];
  const created = [
    { oid: "t1", id: "1", name: "child A", nameText: "child A" },
    { oid: "t2", id: "2", name: "child B", nameText: "child B" },
  ];
  let bulkCreateSubtasks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bulkCreateSubtasks = vi.fn().mockResolvedValue(created);
    mockedResolveTask.mockResolvedValue("parent-oid");
    mockedReadBulkItems.mockResolvedValue(items);
    mockedFactory.mockReturnValue({ bulkCreateSubtasks } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls bulkCreateSubtasks with the resolved parent oid and items", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-subtasks", "alpha/#42",
      "--from-file", "tasks.json",
    ]);
    expect(mockedResolveTask).toHaveBeenCalledWith(expect.anything(), "alpha/#42");
    expect(mockedReadBulkItems).toHaveBeenCalledWith("tasks.json");
    expect(bulkCreateSubtasks).toHaveBeenCalledWith("parent-oid", items, {});
  });

  it("passes through --position", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-subtasks", "alpha/#42",
      "--from-file", "tasks.json",
      "--position", "after",
    ]);
    expect(bulkCreateSubtasks).toHaveBeenCalledWith("parent-oid", items, { position: "after" });
  });

  it("rejects an invalid --position", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync([
        "node", "test", "task", "bulk-subtasks", "alpha/#42",
        "--from-file", "tasks.json",
        "--position", "middle",
      ]),
    ).rejects.toThrow(/--position must be one of/);
    expect(bulkCreateSubtasks).not.toHaveBeenCalled();
  });
});
