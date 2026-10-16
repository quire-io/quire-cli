/**
 * `--private` on create and `--private` / `--no-private` on update for the
 * five records that carry it (api-client 1.1.0). Omitting both leaves the
 * field off the request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/quire-client.js", () => ({
  createQuireClient: vi.fn(),
}));

import { registerChatCommand } from "../../../src/commands/chat.js";
import { registerDashboardCommand } from "../../../src/commands/dashboard.js";
import { registerDocCommand } from "../../../src/commands/doc.js";
import { registerInsightCommand } from "../../../src/commands/insight.js";
import { registerSublistCommand } from "../../../src/commands/sublist.js";
import { createQuireClient } from "../../../src/quire-client.js";
import { captureStdout, makeRootProgram } from "./_helpers.js";

const mockedFactory = vi.mocked(createQuireClient);

const record = { oid: "x1", id: "x", name: "X", nameText: "X", members: null, private: true };

type Register = (p: ReturnType<typeof makeRootProgram>) => void;

const KINDS: { kind: string; register: Register; create: string; update: string }[] = [
  { kind: "sublist", register: registerSublistCommand, create: "createSublist", update: "updateSublist" },
  { kind: "doc", register: registerDocCommand, create: "createDocument", update: "updateDocument" },
  { kind: "chat", register: registerChatCommand, create: "createChat", update: "updateChat" },
  { kind: "insight", register: registerInsightCommand, create: "createInsight", update: "updateInsight" },
  { kind: "dashboard", register: registerDashboardCommand, create: "createDashboard", update: "updateDashboard" },
];

describe("private on works", () => {
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    client = {
      resolveProjectOid: vi.fn().mockResolvedValue("p1"),
    };
    for (const k of KINDS) {
      client[k.create] = vi.fn().mockResolvedValue(record);
      client[k.update] = vi.fn().mockResolvedValue(record);
    }
    mockedFactory.mockReturnValue(client as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(register: Register, argv: string[]): Promise<string> {
    const out = captureStdout();
    const program = makeRootProgram();
    register(program);
    await program.parseAsync(["node", "test", ...argv]);
    return out.output();
  }

  for (const k of KINDS) {
    it(`${k.kind} create forwards --private`, async () => {
      await run(k.register, [k.kind, "create", "alpha", "--name", "N", "--private"]);
      expect(client[k.create]).toHaveBeenCalledWith("project", "p1", { name: "N", private: true });
    });

    it(`${k.kind} update maps --private / --no-private and omits it otherwise`, async () => {
      await run(k.register, [k.kind, "update", "x1", "--private"]);
      expect(client[k.update]).toHaveBeenLastCalledWith("x1", { private: true });
      await run(k.register, [k.kind, "update", "x1", "--no-private"]);
      expect(client[k.update]).toHaveBeenLastCalledWith("x1", { private: false });
      await run(k.register, [k.kind, "update", "x1", "--name", "M"]);
      expect(client[k.update]).toHaveBeenLastCalledWith("x1", { name: "M" });
    });

    it(`${k.kind} output shows the Private line`, async () => {
      const out = await run(k.register, [k.kind, "update", "x1", "--private"]);
      expect(out).toMatch(/Private\s+yes/);
    });
  }
});
