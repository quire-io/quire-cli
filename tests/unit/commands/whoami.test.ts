import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerWhoamiCommand } from "../../../src/commands/whoami.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStderr, captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

const me = {
  oid: "0user0user0user0user0123",
  id: "alice",
  name: "Alice",
  nameText: "Alice",
  email: "alice@example.com",
};

const orgs = [
  { oid: "o1", id: "alpha", name: "Alpha Org", nameText: "Alpha Org" },
  { oid: "o2", id: "beta", name: "Beta Org" },
];

describe("quire whoami", () => {
  let getMe: ReturnType<typeof vi.fn>;
  let listOrganizations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getMe = vi.fn().mockResolvedValue(me);
    listOrganizations = vi.fn().mockResolvedValue(orgs);
    mockedFactory.mockReturnValue({ getMe, listOrganizations } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints display name + email + org list to stderr (default human form)", async () => {
    captureStdout();
    const { output: stderr } = captureStderr();
    const program = makeRootProgram();
    registerWhoamiCommand(program);
    await program.parseAsync(["node", "test", "whoami"]);
    expect(getMe).toHaveBeenCalledOnce();
    expect(listOrganizations).toHaveBeenCalledOnce();
    const text = stderr();
    expect(text).toContain("Alice");
    expect(text).toContain("alice@example.com");
    expect(text).toContain("Alpha Org");
    expect(text).toContain("Beta Org");
  });

  it("emits the merged user + organizations object with --json", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerWhoamiCommand(program);
    await program.parseAsync(["node", "test", "--json", "whoami"]);
    expect(JSON.parse(output().trim())).toEqual({ ...me, organizations: orgs });
  });

  it("emits the user OID only with --quiet", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerWhoamiCommand(program);
    await program.parseAsync(["node", "test", "--quiet", "whoami"]);
    expect(output()).toBe("0user0user0user0user0123\n");
  });
});
