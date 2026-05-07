import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerOrgCommand } from "../../../src/commands/org.js";
import { registerTaskCommand } from "../../../src/commands/task.js";
import { registerWhoamiCommand } from "../../../src/commands/whoami.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

const orgs = [
  { oid: "0org0org0org0org0org0001", id: "alpha", name: "Alpha Org", nameText: "Alpha Org" },
  { oid: "0org0org0org0org0org0002", id: "beta", name: "Beta Org", nameText: "Beta Org" },
];

const orgDetail = {
  oid: "0org0org0org0org0org0001",
  id: "alpha",
  name: "Alpha Org",
  nameText: "Alpha Org",
  email: "team@alpha.example",
  website: "https://alpha.example",
  descriptionText: "An example org.",
  url: "https://quire.io/o/alpha",
  subscription: { plan: "Pro" },
  createdAt: "2025-01-15T08:00:00Z",
};

const tasks = [
  {
    oid: "0task0task0task0task0001",
    id: 408,
    name: "Write the docs",
    nameText: "Write the docs",
    status: { value: 0, name: "To-do" },
    due: "2026-12-31",
  },
  {
    oid: "0task0task0task0task0002",
    id: 409,
    name: "Ship the thing",
    nameText: "Ship the thing",
    status: { value: 100, name: "Done" },
    due: undefined,
  },
];

const taskDetail = {
  oid: "0task0task0task0task0001",
  id: 408,
  name: "Write the docs",
  nameText: "Write the docs",
  status: { value: 0, name: "To-do" },
  priority: { value: 0, name: "Medium" },
  start: "2026-12-01",
  due: "2026-12-31",
  descriptionText: "Doc up the new flow.",
  url: "https://quire.io/w/proj/408",
  createdAt: "2026-01-15T08:00:00Z",
  editedAt: "2026-04-01T10:00:00Z",
};

const me = {
  oid: "0user0user0user0user0123",
  id: "alice",
  name: "Alice",
  nameText: "Alice",
  email: "alice@example.com",
};

describe("human-form snapshots", () => {
  beforeEach(() => {
    mockedFactory.mockReturnValue({
      listOrganizations: vi.fn().mockResolvedValue(orgs),
      resolveOrgOid: vi.fn().mockResolvedValue("0org0org0org0org0org0001"),
      getOrganization: vi.fn().mockResolvedValue(orgDetail),
      resolveProjectOid: vi.fn().mockResolvedValue("0proj0proj0proj0proj0001"),
      listTasks: vi.fn().mockResolvedValue(tasks),
      getTask: vi.fn().mockResolvedValue(taskDetail),
      getMe: vi.fn().mockResolvedValue(me),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("org list renders the ID / NAME / OID table", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    await program.parseAsync(["node", "test", "org", "list"]);
    expect(output()).toMatchInlineSnapshot(`
      "ID     NAME       OID
      alpha  Alpha Org  0org0org0org0org0org0001
      beta   Beta Org   0org0org0org0org0org0002
      "
    `);
  });

  it("org get renders the labeled key/value block", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    await program.parseAsync(["node", "test", "org", "get", "alpha"]);
    expect(output()).toMatchInlineSnapshot(`
      "Name         Alpha Org
      ID           alpha
      OID          0org0org0org0org0org0001
      Email        team@alpha.example
      Website      https://alpha.example
      Description  An example org.
      URL          https://quire.io/o/alpha
      Plan         Pro
      Created at   2025-01-15T08:00:00Z
      "
    `);
  });

  it("task list renders the shared TASK_LIST_COLUMNS table", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "task", "list", "0proj0proj0proj0proj0001"]);
    expect(output()).toMatchInlineSnapshot(`
      "ID    NAME            STATUS  DUE         OID
      #408  Write the docs  To-do   2026-12-31  0task0task0task0task0001
      #409  Ship the thing  Done                0task0task0task0task0002
      "
    `);
  });

  it("task get renders the shared TASK_GET_FIELDS key/value block", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerTaskCommand(program);
    await program.parseAsync(["node", "test", "task", "get", "0task0task0task0task0001"]);
    expect(output()).toMatchInlineSnapshot(`
      "Name         Write the docs
      ID           #408
      OID          0task0task0task0task0001
      Status       To-do
      Priority     Medium
      Start        2026-12-01
      Due          2026-12-31
      Description  Doc up the new flow.
      URL          https://quire.io/w/proj/408
      Created at   2026-01-15T08:00:00Z
      Edited at    2026-04-01T10:00:00Z
      "
    `);
  });

  it("whoami renders the human form to stderr (logger route)", async () => {
    captureStdout();
    const { output: stderr } = captureStderr();
    mockedFactory.mockReturnValue({
      getMe: vi.fn().mockResolvedValue(me),
      listOrganizations: vi.fn().mockResolvedValue(orgs),
    } as never);
    const program = makeRootProgram();
    registerWhoamiCommand(program);
    await program.parseAsync(["node", "test", "whoami"]);
    expect(stderr()).toMatchInlineSnapshot(`
      "Alice <alice@example.com>
        Organizations:
          - Alpha Org  0org0org0org0org0org0001
          - Beta Org  0org0org0org0org0org0002
      "
    `);
  });
});
