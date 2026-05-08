import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerPartnerCommand } from "../../../src/commands/partner.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

describe("quire partner list", () => {
  const partners = [
    { oid: "p1", name: "Acme Inc", color: 3 },
    { oid: "p2", name: "Globex" },
  ];
  let resolveProjectOid: ReturnType<typeof vi.fn>;
  let listPartners: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveProjectOid = vi.fn().mockResolvedValue("proj1");
    listPartners = vi.fn().mockResolvedValue(partners);
    mockedFactory.mockReturnValue({ resolveProjectOid, listPartners } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a table by default", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerPartnerCommand(program);
    await program.parseAsync(["node", "test", "partner", "list", "alpha-proj"]);
    expect(resolveProjectOid).toHaveBeenCalledWith("alpha-proj");
    expect(listPartners).toHaveBeenCalledWith("proj1");
    const out = output();
    expect(out).toContain("NAME");
    expect(out).toContain("Acme Inc");
    expect(out).toContain("p1");
  });

  it("emits OIDs only with --quiet", async () => {
    const { output } = captureStdout();
    const program = makeRootProgram();
    registerPartnerCommand(program);
    await program.parseAsync(["node", "test", "--quiet", "partner", "list", "alpha-proj"]);
    expect(output()).toBe("p1\np2\n");
  });
});

describe("quire partner get", () => {
  const partner = { oid: "p1", name: "Acme Inc", color: 3 };
  let getPartner: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getPartner = vi.fn().mockResolvedValue(partner);
    mockedFactory.mockReturnValue({ getPartner } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls getPartner with the OID", async () => {
    captureStdout();
    const program = makeRootProgram();
    registerPartnerCommand(program);
    await program.parseAsync(["node", "test", "partner", "get", "p1"]);
    expect(getPartner).toHaveBeenCalledWith("p1");
  });
});
