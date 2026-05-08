import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerOrgCommand } from "../../../src/commands/org.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

describe("quire org list", () => {
  const orgs = [
    { oid: "o1", id: "alpha-org", name: "Alpha Org", nameText: "Alpha Org" },
    { oid: "o2", id: "beta-org", name: "Beta Org" },
  ];
  let listOrganizations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listOrganizations = vi.fn().mockResolvedValue(orgs);
    mockedFactory.mockReturnValue({ listOrganizations } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a table by default", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    await program.parseAsync(["node", "test", "org", "list"]);
    expect(listOrganizations).toHaveBeenCalledOnce();
    const out = output();
    expect(out).toContain("ID");
    expect(out).toContain("NAME");
    expect(out).toContain("OID");
    expect(out).toContain("alpha-org");
    expect(out).toContain("Alpha Org");
    expect(out).toContain("o1");
  });

  it("emits raw JSON with --json", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    await program.parseAsync(["node", "test", "--json", "org", "list"]);
    const text = output().trim();
    expect(JSON.parse(text)).toEqual(orgs);
  });

  it("emits OIDs only with --quiet", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    await program.parseAsync(["node", "test", "--quiet", "org", "list"]);
    expect(output()).toBe("o1\no2\n");
  });

  it("threads --profile through to createQuireClient", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    await program.parseAsync(["node", "test", "--profile", "work", "org", "list"]);
    expect(mockedFactory).toHaveBeenCalledWith({ profile: "work" });
  });
});

describe("quire org update", () => {
  const updated = { oid: "o1", id: "alpha-org", name: "New Name", nameText: "New Name" };
  let resolveOrgOid: ReturnType<typeof vi.fn>;
  let updateOrganization: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveOrgOid = vi.fn().mockResolvedValue("o1");
    updateOrganization = vi.fn().mockResolvedValue(updated);
    mockedFactory.mockReturnValue({ resolveOrgOid, updateOrganization } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an empty body with a ValidationError", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    program.exitOverride();
    await expect(
      program.parseAsync(["node", "test", "org", "update", "alpha-org"]),
    ).rejects.toThrow(/at least one of/);
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  it("sends name, description, and follower deltas", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerOrgCommand(program);
    await program.parseAsync([
      "node", "test", "org", "update", "alpha-org",
      "--name", "New Name",
      "--description", "Hello",
      "--add-follower", "u1",
      "--add-follower", "u2",
      "--remove-follower", "u3",
    ]);
    expect(resolveOrgOid).toHaveBeenCalledWith("alpha-org");
    expect(updateOrganization).toHaveBeenCalledWith("o1", {
      name: "New Name",
      description: "Hello",
      addFollowers: ["u1", "u2"],
      removeFollowers: ["u3"],
    });
  });
});
