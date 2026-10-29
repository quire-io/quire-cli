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

describe("quire sublist create", () => {
  const sublist = { oid: "s1", id: "phase-1", name: "Phase 1", nameText: "Phase 1" };
  let createSublist: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createSublist = vi.fn().mockResolvedValue(sublist);
    mockedResolveTask.mockImplementation(async (_client, input) => `oid-${input}`);
    mockedFactory.mockReturnValue({ createSublist, resolveProjectOid: vi.fn().mockResolvedValue("p1") } as never);
    captureStdout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(argv: string[]): Promise<void> {
    const program = makeRootProgram();
    registerSublistCommand(program);
    await program.parseAsync(["node", "test", "sublist", "create", "alpha", "--name", "Phase 1", ...argv]);
  }

  it("sends --start / --due and the resolved --include tasks", async () => {
    await run(["--start", "2026-11-01", "--due", "2026-11-30", "--include", "alpha/#1", "--include", "alpha/#2"]);
    expect(mockedResolveTask).toHaveBeenCalledWith(expect.anything(), "alpha/#1");
    expect(mockedResolveTask).toHaveBeenCalledWith(expect.anything(), "alpha/#2");
    expect(createSublist).toHaveBeenCalledWith("project", "p1", {
      name: "Phase 1", start: "2026-11-01", due: "2026-11-30", includes: ["oid-alpha/#1", "oid-alpha/#2"],
    });
  });

  it("leaves start, due and includes off when not given", async () => {
    await run([]);
    expect(mockedResolveTask).not.toHaveBeenCalled();
    expect(createSublist).toHaveBeenCalledWith("project", "p1", { name: "Phase 1" });
  });
});

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
