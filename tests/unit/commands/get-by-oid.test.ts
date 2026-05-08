import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerCommentCommand } from "../../../src/commands/comment.js";
import { registerStatusCommand } from "../../../src/commands/status.js";
import { registerSublistCommand } from "../../../src/commands/sublist.js";
import { registerTagCommand } from "../../../src/commands/tag.js";
import { registerUserCommand } from "../../../src/commands/user.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

afterEach(() => vi.restoreAllMocks());

describe("single-resource `get` by OID", () => {
  it("`tag get` calls getTag with the OID", async () => {
    const getTag = vi.fn().mockResolvedValue({ oid: "tag1", name: "Bug" });
    mockedFactory.mockReturnValue({ getTag } as never);
    captureStdout();
    const program = makeRootProgram();
    registerTagCommand(program);
    await program.parseAsync(["node", "test", "tag", "get", "tag1"]);
    expect(getTag).toHaveBeenCalledWith("tag1");
  });

  it("`sublist get` calls getSublist with the OID", async () => {
    const getSublist = vi.fn().mockResolvedValue({ oid: "s1", id: "phase-1", name: "Phase 1" });
    mockedFactory.mockReturnValue({ getSublist } as never);
    captureStdout();
    const program = makeRootProgram();
    registerSublistCommand(program);
    await program.parseAsync(["node", "test", "sublist", "get", "s1"]);
    expect(getSublist).toHaveBeenCalledWith("s1");
  });

  it("`comment get` calls getComment with the OID", async () => {
    const getComment = vi.fn().mockResolvedValue({ oid: "c1", descriptionText: "lgtm" });
    mockedFactory.mockReturnValue({ getComment } as never);
    captureStdout();
    const program = makeRootProgram();
    registerCommentCommand(program);
    await program.parseAsync(["node", "test", "comment", "get", "c1"]);
    expect(getComment).toHaveBeenCalledWith("c1");
  });

  it("`status get <project> <value>` resolves project, parses value, calls getStatus", async () => {
    const resolveProjectOid = vi.fn().mockResolvedValue("proj1");
    const getStatus = vi.fn().mockResolvedValue({ oid: "st1", name: "Done", value: 100, color: "00" });
    mockedFactory.mockReturnValue({ resolveProjectOid, getStatus } as never);
    captureStdout();
    const program = makeRootProgram();
    registerStatusCommand(program);
    await program.parseAsync(["node", "test", "status", "get", "alpha-proj", "100"]);
    expect(resolveProjectOid).toHaveBeenCalledWith("alpha-proj");
    expect(getStatus).toHaveBeenCalledWith("proj1", 100);
  });

  it("`status get` rejects out-of-range numeric values", async () => {
    const program = makeRootProgram();
    registerStatusCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync(["node", "test", "status", "get", "alpha-proj", "200"]),
    ).rejects.toThrow(/must be an integer 0-100/);
  });

  it("`user get` calls getUser with the OID", async () => {
    const getUser = vi.fn().mockResolvedValue({ oid: "u1", id: "alice", name: "Alice" });
    mockedFactory.mockReturnValue({ getUser } as never);
    captureStdout();
    const program = makeRootProgram();
    registerUserCommand(program);
    await program.parseAsync(["node", "test", "user", "get", "u1"]);
    expect(getUser).toHaveBeenCalledWith("u1");
  });
});
