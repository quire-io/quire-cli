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
