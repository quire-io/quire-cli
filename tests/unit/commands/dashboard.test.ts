import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerDashboardCommand } from "../../../src/commands/dashboard.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

const dash = {
  oid: "0dash0dash0dash0dash0001",
  id: "sprint-board",
  name: "Sprint Board",
  nameText: "Sprint Board",
  url: "https://quire.io/w/my_project/dashboard/sprint-board",
};

describe("quire dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list resolves the project owner and defaults --owner-type to project", async () => {
    const resolveProjectOid = vi.fn().mockResolvedValue("0proj0proj0proj0proj0001");
    const listDashboards = vi.fn().mockResolvedValue([dash]);
    mockedFactory.mockReturnValue({ resolveProjectOid, listDashboards } as never);

    const out = captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerDashboardCommand(program);
    await program.parseAsync(["node", "test", "dashboard", "list", "my_project"]);

    expect(resolveProjectOid).toHaveBeenCalledWith("my_project");
    expect(listDashboards).toHaveBeenCalledWith("project", "0proj0proj0proj0proj0001");
    expect(out.output()).toContain("Sprint Board");
  });

  it("list with --owner-type organization resolves via resolveOrgOid", async () => {
    const resolveOrgOid = vi.fn().mockResolvedValue("0org0org0org0org0org0001");
    const listDashboards = vi.fn().mockResolvedValue([]);
    mockedFactory.mockReturnValue({ resolveOrgOid, listDashboards } as never);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerDashboardCommand(program);
    await program.parseAsync([
      "node", "test", "dashboard", "list", "my-org", "--owner-type", "organization",
    ]);

    expect(resolveOrgOid).toHaveBeenCalledWith("my-org");
    expect(listDashboards).toHaveBeenCalledWith("organization", "0org0org0org0org0org0001");
  });

  it("list with --owner-type folder rejects a non-OID owner", async () => {
    mockedFactory.mockReturnValue({} as never);
    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerDashboardCommand(program);
    await expect(
      program.parseAsync(["node", "test", "dashboard", "list", "my-folder", "--owner-type", "folder"]),
    ).rejects.toThrow(/requires an OID/);
  });

  it("get by slug uses getDashboardById with the project owner type", async () => {
    const getDashboardById = vi.fn().mockResolvedValue(dash);
    mockedFactory.mockReturnValue({ getDashboardById } as never);

    const out = captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerDashboardCommand(program);
    await program.parseAsync(["node", "test", "dashboard", "get", "my_project/sprint-board"]);

    expect(getDashboardById).toHaveBeenCalledWith("project", "my_project", "sprint-board");
    expect(out.output()).toContain("Sprint Board");
  });

  it("update maps 'null' dates to null and --archive to archived:true", async () => {
    const updateDashboard = vi.fn().mockResolvedValue(dash);
    mockedFactory.mockReturnValue({ updateDashboard } as never);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerDashboardCommand(program);
    await program.parseAsync([
      "node", "test", "dashboard", "update", "0dash0dash0dash0dash0001",
      "--start", "null",
      "--due", "2026-12-31",
      "--archive",
    ]);

    expect(updateDashboard).toHaveBeenCalledWith("0dash0dash0dash0dash0001", {
      start: null,
      due: "2026-12-31",
      archived: true,
    });
  });

  it("update with no change-flags fails validation", async () => {
    mockedFactory.mockReturnValue({} as never);
    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerDashboardCommand(program);
    await expect(
      program.parseAsync(["node", "test", "dashboard", "update", "0dash0dash0dash0dash0001"]),
    ).rejects.toThrow(/at least one change-flag/);
  });

  it("create forwards owner, dates, and partner", async () => {
    const resolveProjectOid = vi.fn().mockResolvedValue("0proj0proj0proj0proj0001");
    const createDashboard = vi.fn().mockResolvedValue(dash);
    mockedFactory.mockReturnValue({ resolveProjectOid, createDashboard } as never);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerDashboardCommand(program);
    await program.parseAsync([
      "node", "test", "dashboard", "create", "my_project",
      "--name", "Sprint Board",
      "--start", "2026-09-01",
      "--due", "2026-09-30",
      "--partner", "0part0part0part0part0001",
    ]);

    expect(createDashboard).toHaveBeenCalledWith("project", "0proj0proj0proj0proj0001", {
      name: "Sprint Board",
      start: "2026-09-01",
      due: "2026-09-30",
      partner: "0part0part0part0part0001",
    });
  });
});
