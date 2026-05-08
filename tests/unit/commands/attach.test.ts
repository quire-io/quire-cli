import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

import { registerCommentCommand } from "../../../src/commands/comment.js";
import { registerTaskCommand } from "../../../src/commands/task.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);

describe("attach commands", () => {
  let dir: string;
  let attachTaskFile: ReturnType<typeof vi.fn>;
  let attachCommentFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "quire-attach-cmd-"));
    attachTaskFile = vi.fn().mockResolvedValue({
      name: "report.pdf",
      url: "https://quire.io/uploads/abc/report.pdf",
      length: 4,
    });
    attachCommentFile = vi.fn().mockResolvedValue({
      name: "report.pdf",
      url: "https://quire.io/uploads/def/report.pdf",
      length: 4,
    });
    mockedResolveTask.mockResolvedValue("task-oid");
    mockedFactory.mockReturnValue({ attachTaskFile, attachCommentFile } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("`task attach` reads bytes, resolves task, calls attachTaskFile with derived filename+content-type", async () => {
    const file = join(dir, "report.pdf");
    writeFileSync(file, Buffer.from([0x25, 0x50, 0x44, 0x46]));
    captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "task", "attach", "alpha/#42", file]);
    expect(mockedResolveTask).toHaveBeenCalledWith(expect.anything(), "alpha/#42");
    expect(attachTaskFile).toHaveBeenCalledWith(
      "task-oid",
      "report.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
  });

  it("`comment attach` calls attachCommentFile with the OID directly (no task-id resolve)", async () => {
    const file = join(dir, "notes.txt");
    writeFileSync(file, "hello");
    captureStdout();
    const program = makeRootProgram();
    registerCommentCommand(program);
    await program.parseAsync(["node", "test", "comment", "attach", "comment-oid-xyz", file]);
    expect(attachCommentFile).toHaveBeenCalledWith(
      "comment-oid-xyz",
      "notes.txt",
      expect.any(Buffer),
      "text/plain",
    );
  });

  it("`task attach` honors --filename and --content-type overrides", async () => {
    const file = join(dir, "blob.dat");
    writeFileSync(file, "x");
    captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync([
      "node", "test", "task", "attach", "alpha/#42", file,
      "--filename", "renamed.csv",
      "--content-type", "text/csv",
    ]);
    expect(attachTaskFile).toHaveBeenCalledWith(
      "task-oid",
      "renamed.csv",
      expect.any(Buffer),
      "text/csv",
    );
  });
});
