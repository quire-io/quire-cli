import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerInsightCommand } from "../../../src/commands/insight.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

const insight = { oid: "0ins0ins0ins0ins0ins0001", id: "burn", name: "Burn", nameText: "Burn" };
const field = { name: "Cost", type: "formula" };

describe("quire insight", () => {
  let listInsights: ReturnType<typeof vi.fn>;
  let createInsight: ReturnType<typeof vi.fn>;
  let addInsightField: ReturnType<typeof vi.fn>;
  let updateInsightField: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listInsights = vi.fn().mockResolvedValue([insight]);
    createInsight = vi.fn().mockResolvedValue(insight);
    addInsightField = vi.fn().mockResolvedValue(field);
    updateInsightField = vi.fn().mockResolvedValue(field);
    mockedFactory.mockReturnValue({
      listInsights, createInsight, addInsightField, updateInsightField,
      resolveProjectOid: vi.fn().mockResolvedValue("p1"),
      resolveOrgOid: vi.fn().mockResolvedValue("o1"),
    } as never);
    captureStdout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(argv: string[]): Promise<void> {
    const program = makeRootProgram();
    registerInsightCommand(program);
    await program.parseAsync(["node", "test", ...argv]);
  }

  it("list always sends the owner type, project by default", async () => {
    await run(["insight", "list", "alpha"]);
    expect(listInsights).toHaveBeenCalledWith("project", "p1");
  });

  it("list resolves an organization owner", async () => {
    await run(["insight", "list", "my-org", "--owner-type", "organization"]);
    expect(listInsights).toHaveBeenCalledWith("organization", "o1");
  });

  it("list requires an OID for a folder owner", async () => {
    await expect(run(["insight", "list", "my-folder", "--owner-type", "folder"])).rejects.toThrowError(
      /requires an OID/,
    );
  });

  it("create passes the owner type and --partner through", async () => {
    await run(["insight", "create", "my-org", "--owner-type", "organization", "--name", "Burn", "--partner", "pt1"]);
    expect(createInsight).toHaveBeenCalledWith("organization", "o1", { name: "Burn", partner: "pt1" });
  });

  it("create refuses --member together with --partner", async () => {
    await expect(
      run(["insight", "create", "alpha", "--name", "Burn", "--member", "me", "--partner", "pt1"]),
    ).rejects.toThrowError(/Cannot combine --member/);
    expect(createInsight).not.toHaveBeenCalled();
  });

  it("field add forwards the access flags", async () => {
    await run([
      "insight", "field", "add", insight.oid, "--name", "Cost", "--type", "formula",
      "--view-member", "me", "--edit-members-admins-only", "--locked",
    ]);
    expect(addInsightField).toHaveBeenCalledWith(insight.oid, {
      name: "Cost", type: "formula", viewMembers: ["me"], editMembers: [], locked: true,
    });
  });

  it("field update can lift a restriction and unlock", async () => {
    await run(["insight", "field", "update", insight.oid, "Cost", "--view-members-anyone", "--no-locked"]);
    expect(updateInsightField).toHaveBeenCalledWith(insight.oid, "Cost", { viewMembers: null, locked: false });
  });
});
