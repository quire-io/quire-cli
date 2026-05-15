import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerNotifyCommand } from "../../../src/commands/notify.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

describe("quire notify", () => {
  let sendNotification: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendNotification = vi.fn().mockResolvedValue(undefined);
    mockedFactory.mockReturnValue({ sendNotification } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires --message", async () => {
    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync(["node", "test", "notify"]),
    ).rejects.toThrow();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends message and url, prints success on stderr", async () => {
    captureStdout();
    const { output: stderrOutput } = captureStderr();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    await program.parseAsync([
      "node", "test", "notify",
      "--message", "Deploy finished",
      "--url", "https://example.com/build/42",
    ]);
    expect(sendNotification).toHaveBeenCalledWith({
      message: "Deploy finished",
      url: "https://example.com/build/42",
    });
    expect(stderrOutput()).toContain("Notification sent.");
  });

  it("emits {sent:true} JSON with --json", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    await program.parseAsync(["node", "test", "--json", "notify", "--message", "hi"]);
    expect(JSON.parse(output().trim())).toEqual({ sent: true });
  });

  it("stays silent on stderr with --quiet", async () => {
    captureStdout();
    const { output: stderrOutput } = captureStderr();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    await program.parseAsync(["node", "test", "--quiet", "notify", "--message", "hi"]);
    expect(stderrOutput()).toBe("");
  });

  it("passes recipients when --recipient is repeated", async () => {
    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    await program.parseAsync([
      "node", "test", "notify",
      "--message", "ship it",
      "--recipient", "alice@example.com",
      "--recipient", "bob@example.com",
    ]);
    expect(sendNotification).toHaveBeenCalledWith({
      message: "ship it",
      recipients: ["alice@example.com", "bob@example.com"],
    });
  });

  it("sends recipients: [\"*\"] with --all", async () => {
    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    await program.parseAsync([
      "node", "test", "notify",
      "--message", "site-wide",
      "--all",
    ]);
    expect(sendNotification).toHaveBeenCalledWith({
      message: "site-wide",
      recipients: ["*"],
    });
  });

  it("rejects combining --all and --recipient", async () => {
    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    await expect(
      program.parseAsync([
        "node", "test", "notify",
        "--message", "x",
        "--all",
        "--recipient", "alice@example.com",
      ]),
    ).rejects.toThrow(/Cannot combine --all and --recipient/);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("omits recipients when neither flag is set (self-notify)", async () => {
    captureStdout();
    captureStderr();
    const program = makeRootProgram();
    registerNotifyCommand(program);
    await program.parseAsync(["node", "test", "notify", "--message", "hi"]);
    expect(sendNotification).toHaveBeenCalledWith({ message: "hi" });
  });
});
