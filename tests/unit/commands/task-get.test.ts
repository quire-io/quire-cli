import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerTaskCommand } from "../../../src/commands/task.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

const sampleTask = {
  oid: "0resolved0OID0resolved01",
  id: 408,
  name: "Write the docs",
  nameText: "Write the docs",
  status: { value: 0, name: "To-do" },
  priority: { value: 0, name: "Medium" },
  due: "2026-12-31",
};

describe("quire task get", () => {
  let getTask: ReturnType<typeof vi.fn>;
  let getTaskByProjectAndId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getTask = vi.fn().mockResolvedValue(sampleTask);
    getTaskByProjectAndId = vi.fn().mockResolvedValue(sampleTask);
    mockedFactory.mockReturnValue({ getTask, getTaskByProjectAndId } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls getTask directly when given an OID-shaped id", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "task", "get", "0task0task0task0task0123"]);
    expect(getTask).toHaveBeenCalledWith("0task0task0task0task0123");
    expect(getTaskByProjectAndId).not.toHaveBeenCalled();
    expect(output()).toContain("Write the docs");
    expect(output()).toContain("#408");
  });

  it("resolves project-slug/#N form via getTaskByProjectAndId, then getTask", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "task", "get", "my-proj/#408"]);
    expect(getTaskByProjectAndId).toHaveBeenCalledWith("my-proj", "408");
    expect(getTask).toHaveBeenCalledWith("0resolved0OID0resolved01");
  });

  it("emits raw JSON with --json", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "--json", "task", "get", "0task0task0task0task0123"]);
    expect(JSON.parse(output().trim())).toEqual(sampleTask);
  });

  it("rejects ambiguous bare-id forms with a ValidationError (exit 3)", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await expect(
      program.parseAsync(["node", "test", "task", "get", "#408"]),
    ).rejects.toMatchObject({ name: "ValidationError", exitCode: 3 });
  });
});
