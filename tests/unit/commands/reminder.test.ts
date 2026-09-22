import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

vi.mock("../../../src/util/task-id.js", () => ({
  resolveTaskOid: vi.fn(),
}));

import { registerReminderCommand } from "../../../src/commands/reminder.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { resolveTaskOid } from "../../../src/util/task-id.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);
const mockedResolveTask = vi.mocked(resolveTaskOid);

const reminder = { oid: "r1", when: "2026-10-01T09:00:00Z", leads: [{ minutes: 30 }] };

describe("quire reminder", () => {
  let createReminder: ReturnType<typeof vi.fn>;
  let updateReminder: ReturnType<typeof vi.fn>;
  let listReminders: ReturnType<typeof vi.fn>;
  let deleteReminder: ReturnType<typeof vi.fn>;
  let resolveProjectOid: ReturnType<typeof vi.fn>;
  let resolveOrgOid: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createReminder = vi.fn().mockResolvedValue(reminder);
    updateReminder = vi.fn().mockResolvedValue(reminder);
    listReminders = vi.fn().mockResolvedValue([]);
    deleteReminder = vi.fn().mockResolvedValue(undefined);
    resolveProjectOid = vi.fn().mockResolvedValue("p1");
    resolveOrgOid = vi.fn().mockResolvedValue("o1");
    mockedResolveTask.mockResolvedValue("t1");
    mockedFactory.mockReturnValue({
      createReminder, updateReminder, listReminders, deleteReminder,
      resolveProjectOid, resolveOrgOid,
    } as never);
    captureStdout();
    captureStderr();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(argv: string[]): Promise<void> {
    const program = makeRootProgram();
    registerReminderCommand(program);
    await program.parseAsync(["node", "test", ...argv]);
  }

  describe("create", () => {
    it("defaults the owner type to project and resolves the slug", async () => {
      await run(["reminder", "create", "alpha", "--when", "2026-10-01T09:00:00Z"]);
      expect(resolveProjectOid).toHaveBeenCalledWith("alpha");
      expect(createReminder).toHaveBeenCalledWith("project", "p1", { when: "2026-10-01T09:00:00Z" });
    });

    it("passes '-' through as the caller's own Inbox instead of resolving it", async () => {
      await run(["reminder", "create", "-", "--when", "2026-10-01T09:00:00Z"]);
      expect(resolveProjectOid).not.toHaveBeenCalled();
      expect(createReminder).toHaveBeenCalledWith("project", "-", { when: "2026-10-01T09:00:00Z" });
    });

    it("resolves a task owner through the task-id resolver", async () => {
      await run(["reminder", "create", "alpha/#42", "--owner-type", "task", "--lead", "1d@09:00"]);
      expect(mockedResolveTask).toHaveBeenCalledWith(expect.anything(), "alpha/#42");
      expect(createReminder).toHaveBeenCalledWith("task", "t1", { leads: [{ days: 1, at: "09:00" }] });
    });

    it("requires an OID for a folder owner, which has no slug endpoint", async () => {
      await expect(
        run(["reminder", "create", "my-folder", "--owner-type", "folder"]),
      ).rejects.toThrowError(/requires an OID/);
    });

    it("rejects an unknown owner type", async () => {
      await expect(
        run(["reminder", "create", "alpha", "--owner-type", "task-list"]),
      ).rejects.toThrowError(/--owner-type must be one of/);
    });

    it("builds leads, recurrence and members together", async () => {
      await run([
        "reminder", "create", "alpha",
        "--when", "2026-10-01T09:00:00Z",
        "--lead", "30m", "--lead", "2d",
        "--recurrence-freq", "weekly", "--recurrence-interval", "1",
        "--member", "me",
      ]);
      expect(createReminder).toHaveBeenCalledWith("project", "p1", {
        when: "2026-10-01T09:00:00Z",
        recurrence: { freq: "weekly", interval: 1 },
        leads: [{ minutes: 30 }, { days: 2 }],
        members: ["me"],
      });
    });

    it("refuses --member together with --partner", async () => {
      await expect(
        run(["reminder", "create", "alpha", "--when", "x", "--member", "me", "--partner", "pt1"]),
      ).rejects.toThrowError(/Cannot combine --member/);
      expect(createReminder).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("clears --when on the literal 'null'", async () => {
      await run(["reminder", "update", "r1", "--when", "null"]);
      expect(updateReminder).toHaveBeenCalledWith("r1", { when: null });
    });

    it("clears --name on the literal 'null'", async () => {
      await run(["reminder", "update", "r1", "--name", "null"]);
      expect(updateReminder).toHaveBeenCalledWith("r1", { name: null });
    });

    it("sends recurrence: null for --clear-recurrence", async () => {
      await run(["reminder", "update", "r1", "--clear-recurrence"]);
      expect(updateReminder).toHaveBeenCalledWith("r1", { recurrence: null });
    });

    it("refuses --clear-recurrence alongside the --recurrence-* flags", async () => {
      await expect(
        run(["reminder", "update", "r1", "--clear-recurrence", "--recurrence-freq", "daily", "--recurrence-interval", "1"]),
      ).rejects.toThrowError(/Cannot combine --clear-recurrence/);
    });

    it("replaces the whole lead list", async () => {
      await run(["reminder", "update", "r1", "--lead", "15m"]);
      expect(updateReminder).toHaveBeenCalledWith("r1", { leads: [{ minutes: 15 }] });
    });

    it("requires at least one flag", async () => {
      await expect(run(["reminder", "update", "r1"])).rejects.toThrowError(
        /requires at least one of/,
      );
      expect(updateReminder).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("forwards limit and cursor", async () => {
      await run(["reminder", "list", "alpha", "--limit", "50", "--cursor", "abc"]);
      expect(listReminders).toHaveBeenCalledWith("project", "p1", { limit: 50, cursor: "abc" });
    });

    it("accepts 'no' as an unlimited page size", async () => {
      await run(["reminder", "list", "alpha", "--limit", "no"]);
      expect(listReminders).toHaveBeenCalledWith("project", "p1", { limit: "no" });
    });

    it("rejects a limit outside Quire's 1-1000 range", async () => {
      await expect(run(["reminder", "list", "alpha", "--limit", "1001"])).rejects.toThrowError(
        /--limit must be an integer 1-1000/,
      );
    });

    it("warns that the order is by OID, not fire time", async () => {
      const stderr = captureStderr();
      listReminders.mockResolvedValue([{ oid: "r1" }, { oid: "r2" }]);
      await run(["reminder", "list", "alpha"]);
      expect(stderr.output()).toMatch(/Ordered by OID, not by fire time/);
    });
  });

  describe("delete", () => {
    it("says the delete is permanent and does not promise an undo", async () => {
      const stderr = captureStderr();
      const program = makeRootProgram();
      registerReminderCommand(program);
      await program.parseAsync(["node", "test", "--yes", "reminder", "delete", "r1"]);
      expect(deleteReminder).toHaveBeenCalledWith("r1");
      expect(stderr.output()).not.toMatch(/undo-remove/);
    });

    it("refuses without --yes in a non-interactive shell", async () => {
      const isTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
      try {
        await expect(run(["reminder", "delete", "r1"])).rejects.toThrowError(/Pass --yes/);
        expect(deleteReminder).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(process.stdin, "isTTY", { value: isTTY, configurable: true });
      }
    });
  });
});
