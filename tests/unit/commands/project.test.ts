import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerProjectCommand } from "../../../src/commands/project.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

describe("quire project update", () => {
  const updated = { oid: "p1", id: "alpha-proj", name: "Alpha", nameText: "Alpha" };
  let resolveProjectOid: ReturnType<typeof vi.fn>;
  let updateProject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveProjectOid = vi.fn().mockResolvedValue("p1");
    updateProject = vi.fn().mockResolvedValue(updated);
    mockedFactory.mockReturnValue({ resolveProjectOid, updateProject } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an empty body with a ValidationError", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync(["node", "test", "project", "update", "alpha-proj"]),
    ).rejects.toThrow(/at least one of/);
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("rejects --archive combined with --unarchive", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync(["node", "test", "project", "update", "alpha-proj", "--archive", "--unarchive"]),
    ).rejects.toThrow(/Cannot combine --archive and --unarchive/);
  });

  it("rejects --public combined with --private", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync(["node", "test", "project", "update", "alpha-proj", "--public", "--private"]),
    ).rejects.toThrow(/Cannot combine --public and --private/);
  });

  it("clears --start when 'null' is passed", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    await program.parseAsync([
      "node", "test", "project", "update", "alpha-proj",
      "--start", "null",
      "--due", "2026-12-31",
    ]);
    expect(updateProject).toHaveBeenCalledWith("p1", {
      start: null,
      due: "2026-12-31",
    });
  });

  it("sends archive + public + follower deltas together", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    await program.parseAsync([
      "node", "test", "project", "update", "alpha-proj",
      "--archive",
      "--public",
      "--add-follower", "u1",
      "--remove-follower", "u2",
    ]);
    expect(updateProject).toHaveBeenCalledWith("p1", {
      archived: true,
      public: true,
      addFollowers: ["u1"],
      removeFollowers: ["u2"],
    });
  });
});

describe("quire project export", () => {
  const csvBody = "name,status\nDo X,0\nDo Y,100\n";
  const jsonBody = '[{"name":"Do X","status":0}]\n';
  let resolveProjectOid: ReturnType<typeof vi.fn>;
  let exportProjectCsv: ReturnType<typeof vi.fn>;
  let exportProjectJson: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveProjectOid = vi.fn().mockResolvedValue("p1");
    exportProjectCsv = vi.fn().mockResolvedValue(csvBody);
    exportProjectJson = vi.fn().mockResolvedValue(jsonBody);
    mockedFactory.mockReturnValue({
      resolveProjectOid,
      exportProjectCsv,
      exportProjectJson,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to CSV and writes to stdout", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    await program.parseAsync(["node", "test", "project", "export", "alpha-proj"]);
    expect(exportProjectCsv).toHaveBeenCalledWith("p1");
    expect(exportProjectJson).not.toHaveBeenCalled();
    expect(output()).toBe(csvBody);
  });

  it("with --format json calls exportProjectJson", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    await program.parseAsync(["node", "test", "project", "export", "alpha-proj", "--format", "json"]);
    expect(exportProjectJson).toHaveBeenCalledWith("p1");
    expect(output()).toBe(jsonBody);
  });

  it("rejects unknown --format with a ValidationError", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerProjectCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync(["node", "test", "project", "export", "alpha-proj", "--format", "xml"]),
    ).rejects.toThrow(/--format must be one of/);
  });

  it("--output writes to the file and prints a stderr line", async () => {
    const dir = mkdtempSync(join(tmpdir(), "quire-export-"));
    try {
      const target = join(dir, "out.csv");
      captureStdout();
      const { output: stderrOutput } = captureStderr();
      const program = makeRootProgram();
      registerProjectCommand(program);
      await program.parseAsync(["node", "test", "project", "export", "alpha-proj", "--output", target]);
      expect(readFileSync(target, "utf8")).toBe(csvBody);
      expect(stderrOutput()).toContain(`Wrote ${csvBody.length} bytes to ${target}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
