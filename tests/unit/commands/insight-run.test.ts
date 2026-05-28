import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerInsightCommand } from "../../../src/commands/insight.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

describe("quire insight run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const rows = [
    ["Member", "Open", "Done"],
    ["Alice", 3, 7],
    ["Bob", 1, 4],
  ];

  it("forwards --group-by and --status, prints a table by default", async () => {
    const runInsight = vi.fn().mockResolvedValue(rows);
    mockedFactory.mockReturnValue({ runInsight } as never);

    const out = captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerInsightCommand(program);
    await program.parseAsync([
      "node", "test", "insight", "run", "0insight001",
      "--group-by", "member",
      "--status", "active",
    ]);

    expect(runInsight).toHaveBeenCalledWith("0insight001", {
      groupBy: "member",
      status: "active",
    });
    const text = out.output();
    expect(text).toContain("Member");
    expect(text).toContain("Open");
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
  });

  it("emits the raw 2D array on --json", async () => {
    const runInsight = vi.fn().mockResolvedValue(rows);
    mockedFactory.mockReturnValue({ runInsight } as never);

    const out = captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerInsightCommand(program);
    await program.parseAsync([
      "node", "test", "--json", "insight", "run", "0insight001",
    ]);

    expect(runInsight).toHaveBeenCalledWith("0insight001", {});
    expect(JSON.parse(out.output())).toEqual(rows);
  });

  it("prints TSV rows without headers on --quiet", async () => {
    const runInsight = vi.fn().mockResolvedValue(rows);
    mockedFactory.mockReturnValue({ runInsight } as never);

    const out = captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerInsightCommand(program);
    await program.parseAsync([
      "node", "test", "--quiet", "insight", "run", "0insight001",
    ]);

    expect(out.output()).toBe("Alice\t3\t7\nBob\t1\t4\n");
  });

  it("rejects an unknown --group-by value", async () => {
    const runInsight = vi.fn();
    mockedFactory.mockReturnValue({ runInsight } as never);

    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    program.exitOverride();
    registerInsightCommand(program);
    await expect(program.parseAsync([
      "node", "test", "insight", "run", "0insight001",
      "--group-by", "team",
    ])).rejects.toThrow(/--group-by/);
    expect(runInsight).not.toHaveBeenCalled();
  });
});
