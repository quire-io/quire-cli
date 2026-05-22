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

vi.mock("../../../src/util/confirm.js", () => ({
  confirmDestructive: vi.fn(),
}));

import { registerTaskCommand } from "../../../src/commands/task.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { readBulkItems, readBulkRefs } from "../../../src/util/bulk-input.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { confirmDestructive } from "../../../src/util/confirm.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);
const mockedReadBulkItems = vi.mocked(readBulkItems);
const mockedReadBulkRefs = vi.mocked(readBulkRefs);
const mockedConfirm = vi.mocked(confirmDestructive);

// All commands forward --dry-run to api-client and emit a stderr notice when
// the option is set. Each test mocks just enough of the client to assert the
// option payload passed to that specific bulk method.

describe("quire task bulk-* --dry-run", () => {
  const compactRows = [{ oid: "t1", id: 1 }];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bulk-create forwards { dryRun: true } and writes the dry-run notice", async () => {
    const bulkCreateTasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({
      bulkCreateTasks,
      resolveProjectOid: vi.fn().mockResolvedValue("proj-oid"),
    } as never);
    mockedReadBulkItems.mockResolvedValue([{ name: "a" }]);

    captureStdout();
    const err = captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-create", "alpha",
      "--from-file", "tasks.json",
      "--dry-run",
    ]);

    expect(bulkCreateTasks).toHaveBeenCalledWith("proj-oid", [{ name: "a" }], {
      dryRun: true,
    });
    expect(err.output()).toContain("Dry run");
  });

  it("bulk-create omits dryRun when the flag is absent", async () => {
    const bulkCreateTasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({
      bulkCreateTasks,
      resolveProjectOid: vi.fn().mockResolvedValue("proj-oid"),
    } as never);
    mockedReadBulkItems.mockResolvedValue([{ name: "a" }]);

    captureStdout();
    const err = captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-create", "alpha",
      "--from-file", "tasks.json",
    ]);

    expect(bulkCreateTasks).toHaveBeenCalledWith("proj-oid", [{ name: "a" }], {});
    expect(err.output()).not.toContain("Dry run");
  });

  it("bulk-subtasks forwards { dryRun: true } alongside --position", async () => {
    const bulkCreateSubtasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({ bulkCreateSubtasks } as never);
    mockedResolveTask.mockResolvedValue("parent-oid");
    mockedReadBulkItems.mockResolvedValue([{ name: "a" }]);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-subtasks", "alpha/#42",
      "--from-file", "tasks.json",
      "--position", "after",
      "--dry-run",
    ]);

    expect(bulkCreateSubtasks).toHaveBeenCalledWith("parent-oid", [{ name: "a" }], {
      position: "after",
      dryRun: true,
    });
  });

  it("bulk-update forwards { dryRun: true }", async () => {
    const bulkUpdateTasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({
      bulkUpdateTasks,
      resolveProjectOid: vi.fn().mockResolvedValue("proj-oid"),
    } as never);
    mockedReadBulkItems.mockResolvedValue([{ oid: "t1", name: "x" }]);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-update", "alpha",
      "--from-file", "updates.json",
      "--dry-run",
    ]);

    expect(bulkUpdateTasks).toHaveBeenCalledWith(
      "proj-oid",
      [{ oid: "t1", name: "x" }],
      { dryRun: true },
    );
  });

  it("bulk-delete skips the destructive confirmation prompt under --dry-run", async () => {
    const bulkRemoveTasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({
      bulkRemoveTasks,
      resolveProjectOid: vi.fn().mockResolvedValue("proj-oid"),
    } as never);
    mockedReadBulkRefs.mockResolvedValue(["t1"]);

    captureStdout();
    const err = captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-delete", "alpha",
      "--from-file", "refs.txt",
      "--dry-run",
    ]);

    expect(mockedConfirm).not.toHaveBeenCalled();
    expect(bulkRemoveTasks).toHaveBeenCalledWith("proj-oid", ["t1"], {
      dryRun: true,
    });
    expect(err.output()).toContain("Dry run");
  });

  it("bulk-delete still prompts when --dry-run is absent", async () => {
    const bulkRemoveTasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({
      bulkRemoveTasks,
      resolveProjectOid: vi.fn().mockResolvedValue("proj-oid"),
    } as never);
    mockedReadBulkRefs.mockResolvedValue(["t1"]);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-delete", "alpha",
      "--from-file", "refs.txt",
      "--yes",
    ]);

    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(bulkRemoveTasks).toHaveBeenCalledWith("proj-oid", ["t1"], {});
  });

  it("bulk-move forwards { dryRun: true } alongside the resolved parent", async () => {
    const bulkMoveTasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({
      bulkMoveTasks,
      resolveProjectOid: vi.fn().mockResolvedValue("proj-oid"),
    } as never);
    mockedResolveTask.mockResolvedValue("anchor-oid");
    mockedReadBulkRefs.mockResolvedValue(["t1"]);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-move", "alpha",
      "--from-file", "refs.txt",
      "--to", "alpha/#10",
      "--dry-run",
    ]);

    expect(bulkMoveTasks).toHaveBeenCalledWith("proj-oid", ["t1"], {
      task: "anchor-oid",
      dryRun: true,
    });
  });

  it("bulk-transfer forwards { dryRun: true } alongside remap flags", async () => {
    const bulkTransferTasks = vi.fn().mockResolvedValue(compactRows);
    const resolveProjectOid = vi
      .fn()
      .mockImplementation(async (ref: string) =>
        ref === "alpha" ? "src-oid" : "dst-oid",
      );
    mockedFactory.mockReturnValue({
      bulkTransferTasks,
      resolveProjectOid,
    } as never);
    mockedReadBulkRefs.mockResolvedValue(["t1"]);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-transfer", "alpha",
      "--from-file", "refs.txt",
      "--to", "beta",
      "--keep-tags",
      "--dry-run",
    ]);

    expect(bulkTransferTasks).toHaveBeenCalledWith("src-oid", ["t1"], {
      project: "dst-oid",
      tag: true,
      dryRun: true,
    });
  });

  it("bulk-approve forwards { dryRun: true } alongside --state", async () => {
    const bulkApproveTasks = vi.fn().mockResolvedValue(compactRows);
    mockedFactory.mockReturnValue({
      bulkApproveTasks,
      resolveProjectOid: vi.fn().mockResolvedValue("proj-oid"),
    } as never);
    mockedReadBulkRefs.mockResolvedValue(["t1"]);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "bulk-approve", "alpha",
      "--from-file", "refs.txt",
      "--state", "approve",
      "--dry-run",
    ]);

    expect(bulkApproveTasks).toHaveBeenCalledWith("proj-oid", ["t1"], {
      state: "approve",
      dryRun: true,
    });
  });
});
