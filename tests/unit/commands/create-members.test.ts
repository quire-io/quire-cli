/**
 * `--member` / `--members-admins-only` are wired into five separate `create`
 * commands (api-client 1.0.0). The tri-state itself is covered in
 * tests/unit/util/member-flags.test.ts — this file checks each command
 * actually forwards it, and that the two commands with a `--partner` flag
 * reject the pair Quire 400s on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

import { registerChatCommand } from "../../../src/commands/chat.js";
import { registerDashboardCommand } from "../../../src/commands/dashboard.js";
import { registerDocCommand } from "../../../src/commands/doc.js";
import { registerInsightCommand } from "../../../src/commands/insight.js";
import { registerSublistCommand } from "../../../src/commands/sublist.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

const record = { oid: "x1", id: "x", name: "X", nameText: "X" };

describe("--member on create", () => {
  let createSublist: ReturnType<typeof vi.fn>;
  let createDocument: ReturnType<typeof vi.fn>;
  let createChat: ReturnType<typeof vi.fn>;
  let createInsight: ReturnType<typeof vi.fn>;
  let createDashboard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createSublist = vi.fn().mockResolvedValue(record);
    createDocument = vi.fn().mockResolvedValue(record);
    createChat = vi.fn().mockResolvedValue(record);
    createInsight = vi.fn().mockResolvedValue(record);
    createDashboard = vi.fn().mockResolvedValue(record);
    mockedFactory.mockReturnValue({
      createSublist, createDocument, createChat, createInsight, createDashboard,
      resolveProjectOid: vi.fn().mockResolvedValue("p1"),
      resolveOrgOid: vi.fn().mockResolvedValue("o1"),
    } as never);
    captureStdout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(register: (p: ReturnType<typeof makeRootProgram>) => void, argv: string[]): Promise<void> {
    const program = makeRootProgram();
    register(program);
    await program.parseAsync(["node", "test", ...argv]);
  }

  it("sublist create forwards the member list", async () => {
    await run(registerSublistCommand, ["sublist", "create", "alpha", "--name", "P1", "--member", "me"]);
    expect(createSublist).toHaveBeenCalledWith("project", "p1", { name: "P1", members: ["me"] });
  });

  it("sublist create maps --members-admins-only to an empty list", async () => {
    await run(registerSublistCommand, ["sublist", "create", "alpha", "--name", "P1", "--members-admins-only"]);
    expect(createSublist).toHaveBeenCalledWith("project", "p1", { name: "P1", members: [] });
  });

  it("omits the field entirely when neither flag is passed", async () => {
    await run(registerSublistCommand, ["sublist", "create", "alpha", "--name", "P1"]);
    expect(createSublist).toHaveBeenCalledWith("project", "p1", { name: "P1" });
  });

  it("doc create forwards it alongside followers", async () => {
    await run(registerDocCommand, ["doc", "create", "alpha", "--name", "D", "--follower", "me", "--member", "me"]);
    expect(createDocument).toHaveBeenCalledWith("project", "p1", {
      name: "D", followers: ["me"], members: ["me"],
    });
  });

  it("chat create forwards it", async () => {
    await run(registerChatCommand, ["chat", "create", "alpha", "--name", "C", "--member", "me"]);
    expect(createChat).toHaveBeenCalledWith("project", "p1", { name: "C", members: ["me"] });
  });

  it("chat create refuses --member together with --partner", async () => {
    await expect(
      run(registerChatCommand, ["chat", "create", "alpha", "--name", "C", "--member", "me", "--partner", "pt1"]),
    ).rejects.toThrowError(/Cannot combine --member/);
    expect(createChat).not.toHaveBeenCalled();
  });

  it("insight create forwards it", async () => {
    await run(registerInsightCommand, ["insight", "create", "alpha", "--name", "I", "--member", "me"]);
    expect(createInsight).toHaveBeenCalledWith("project", "p1", { name: "I", members: ["me"] });
  });

  it("dashboard create forwards it", async () => {
    await run(registerDashboardCommand, ["dashboard", "create", "alpha", "--name", "D", "--member", "me"]);
    expect(createDashboard).toHaveBeenCalledWith("project", "p1", { name: "D", members: ["me"] });
  });

  it("dashboard create refuses --member together with --partner", async () => {
    await expect(
      run(registerDashboardCommand, ["dashboard", "create", "alpha", "--name", "D", "--member", "me", "--partner", "pt1"]),
    ).rejects.toThrowError(/Cannot combine --member/);
    expect(createDashboard).not.toHaveBeenCalled();
  });
});
