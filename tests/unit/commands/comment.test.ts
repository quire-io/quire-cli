import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

import { registerChatCommand } from "../../../src/commands/chat.js";
import { registerCommentCommand } from "../../../src/commands/comment.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);

const alice = { oid: "u-alice", id: "alice", name: "Alice" };
const bob = { oid: "u-bob", id: "bob", name: "Bob" };

// `createdBy` is the author's OID — a string, unlike the user objects in
// `emojis[].users` (api-client 1.2.0).
const comments = [
  {
    oid: "c1",
    createdAt: "2026-10-16T01:00:00Z",
    createdBy: "u-alice",
    descriptionText: "Looks good",
    emojis: [
      { emoji: "👍", users: [alice, bob] },
      { emoji: "🎉", users: [bob] },
    ],
  },
  { oid: "c2", createdAt: "2026-10-16T02:00:00Z", createdBy: "u-alice", descriptionText: "Shipped" },
  { oid: "c3", createdAt: "2026-10-16T03:00:00Z", createdBy: "u-gone", descriptionText: "Old note" },
  { oid: "c4", createdAt: "2026-10-16T04:00:00Z", createdBy: "ap|0app0app0app", descriptionText: "Bot note" },
];

describe("quire comment", () => {
  let getTaskComments: ReturnType<typeof vi.fn>;
  let getComment: ReturnType<typeof vi.fn>;
  let addComment: ReturnType<typeof vi.fn>;
  let getUser: ReturnType<typeof vi.fn>;
  let addCommentEmojis: ReturnType<typeof vi.fn>;
  let removeCommentEmojis: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getTaskComments = vi.fn().mockResolvedValue(comments);
    getComment = vi.fn().mockResolvedValue(comments[0]);
    addComment = vi.fn().mockResolvedValue(comments[0]);
    getUser = vi.fn(async (oid: string) => {
      if (oid === "u-alice") return alice;
      throw new Error("404");
    });
    addCommentEmojis = vi.fn().mockResolvedValue(undefined);
    removeCommentEmojis = vi.fn().mockResolvedValue(undefined);
    mockedResolveTask.mockResolvedValue("t1");
    mockedFactory.mockReturnValue({
      getTaskComments, getComment, addComment, getUser, addCommentEmojis, removeCommentEmojis,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(argv: string[]): Promise<void> {
    const program = makeRootProgram();
    registerCommentCommand(program);
    await program.parseAsync(["node", "test", ...argv]);
  }

  describe("list", () => {
    it("looks each author up once and shows reaction counts", async () => {
      const out = captureStdout();
      await run(["comment", "list", "proj/#1"]);
      expect(getUser).toHaveBeenCalledTimes(2);
      expect(getUser).toHaveBeenCalledWith("u-alice");
      expect(getUser).toHaveBeenCalledWith("u-gone");
      const lines = out.output().split("\n");
      expect(lines[0]).toMatch(/^WHEN\s+WHO\s+TEXT\s+REACTIONS\s+OID$/);
      expect(lines[1]).toMatch(/Alice\s+Looks good\s+👍2 🎉1\s+c1/);
    });

    it("falls back to the OID when the author can't be looked up", async () => {
      const out = captureStdout();
      await run(["comment", "list", "proj/#1"]);
      expect(out.output()).toMatch(/u-gone\s+Old note/);
    });

    it("shows a comment posted as the app as (app) without looking it up", async () => {
      const out = captureStdout();
      await run(["comment", "list", "proj/#1"]);
      expect(out.output()).toMatch(/\(app\)\s+Bot note/);
      expect(getUser).not.toHaveBeenCalledWith("ap|0app0app0app");
    });

    it("skips the lookups under --json, which prints the raw records", async () => {
      const out = captureStdout();
      await run(["--json", "comment", "list", "proj/#1"]);
      expect(getUser).not.toHaveBeenCalled();
      expect(JSON.parse(out.output())).toEqual(comments);
    });
  });

  describe("get", () => {
    it("shows who reacted with what", async () => {
      const out = captureStdout();
      await run(["comment", "get", "c1"]);
      expect(out.output()).toMatch(/Who\s+Alice/);
      expect(out.output()).toMatch(/Reactions\s+👍 Alice, Bob · 🎉 Bob/);
    });

    it("leaves the Reactions line out when there are none", async () => {
      getComment.mockResolvedValue(comments[1]);
      const out = captureStdout();
      await run(["comment", "get", "c2"]);
      expect(out.output()).not.toMatch(/Reactions/);
    });
  });

  describe("add", () => {
    it("sends no options by default", async () => {
      captureStdout();
      await run(["comment", "add", "proj/#1", "--text", "hi"]);
      expect(addComment).toHaveBeenCalledWith("t1", "hi", {});
    });

    it("maps --pin to pinned and --as-app to asUser", async () => {
      captureStdout();
      await run(["comment", "add", "proj/#1", "--text", "hi", "--pin", "--as-app"]);
      expect(addComment).toHaveBeenCalledWith("t1", "hi", { pinned: true, asUser: true });
    });
  });

  describe("add-emoji / remove-emoji", () => {
    it("takes several emojis as separate or comma-separated arguments", async () => {
      captureStdout();
      const err = captureStderr();
      await run(["comment", "add-emoji", "c1", "👍", "tada,:heart:"]);
      expect(addCommentEmojis).toHaveBeenCalledWith("c1", ["👍", "tada", ":heart:"]);
      expect(err.output()).toContain("Added 👍 tada :heart: to comment c1.");
    });

    it("reports what was sent under --json, since the API returns no body", async () => {
      const out = captureStdout();
      await run(["--json", "comment", "remove-emoji", "c1", "+1"]);
      expect(removeCommentEmojis).toHaveBeenCalledWith("c1", ["+1"]);
      expect(JSON.parse(out.output())).toEqual({ oid: "c1", removed: ["+1"] });
    });

    it("prints just the OID under --quiet", async () => {
      const out = captureStdout();
      await run(["--quiet", "comment", "add-emoji", "c1", "+1"]);
      expect(out.output()).toBe("c1\n");
    });

    it("rejects an argument with no emoji in it", async () => {
      captureStdout();
      await expect(run(["comment", "add-emoji", "c1", ","])).rejects.toThrowError(/at least one emoji/);
      expect(addCommentEmojis).not.toHaveBeenCalled();
    });
  });
});

describe("quire chat comment add", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps --as-app to asUser", async () => {
    const addChatComment = vi.fn().mockResolvedValue(comments[3]);
    mockedFactory.mockReturnValue({ addChatComment, getUser: vi.fn() } as never);
    const out = captureStdout();
    const program = makeRootProgram();
    registerChatCommand(program);
    await program.parseAsync([
      "node", "test", "chat", "comment", "add", "0chat0chat0chat0chat0001", "--text", "hi", "--as-app",
    ]);
    expect(addChatComment).toHaveBeenCalledWith("0chat0chat0chat0chat0001", { description: "hi", asUser: true });
    expect(out.output()).toMatch(/Who\s+\(app\)/);
  });
});
