import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

import { registerSublistCommand } from "../../../src/commands/sublist.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);

describe("quire sublist add-task / remove-task", () => {
  const sublist = { oid: "s1", id: "phase-1", name: "Phase 1", nameText: "Phase 1" };
  let updateSublistMembership: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateSublistMembership = vi.fn().mockResolvedValue(sublist);
    mockedResolveTask.mockResolvedValue("t1");
    mockedFactory.mockReturnValue({ updateSublistMembership } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("add-task sends a single change without exclude", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerSublistCommand(program);
    await program.parseAsync(["node", "test", "sublist", "add-task", "s1", "alpha/#42"]);
    expect(mockedResolveTask).toHaveBeenCalledWith(expect.anything(), "alpha/#42");
    expect(updateSublistMembership).toHaveBeenCalledWith("s1", [{ task: "t1" }]);
  });

  it("remove-task sets exclude: true", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerSublistCommand(program);
    await program.parseAsync(["node", "test", "sublist", "remove-task", "s1", "alpha/#42"]);
    expect(updateSublistMembership).toHaveBeenCalledWith("s1", [{ task: "t1", exclude: true }]);
  });
});
