import { describe, expect, it, vi } from "vitest";

import { resolveTaskOid } from "../../../src/util/task-id.js";

// Minimal QuireClient surface needed by resolveTaskOid: only
// getTaskByProjectAndId is called for non-OID forms.
function makeClient(returnedOid = "0resolved0OID0resolved01") {
  return {
    getTaskByProjectAndId: vi
      .fn()
      .mockResolvedValue({ oid: returnedOid, id: 408 }),
  } as never;
}

describe("resolveTaskOid", () => {
  it("returns the input unchanged for OID-shaped values", async () => {
    const client = makeClient();
    expect(await resolveTaskOid(client, "0task0task0task0task0123")).toBe("0task0task0task0task0123");
    expect(client.getTaskByProjectAndId).not.toHaveBeenCalled();
  });

  it("resolves project-slug/#N via getTaskByProjectAndId", async () => {
    const client = makeClient("0resolved0OID0resolved01");
    expect(await resolveTaskOid(client, "my-proj/#408")).toBe("0resolved0OID0resolved01");
    expect(client.getTaskByProjectAndId).toHaveBeenCalledWith("my-proj", "408");
  });

  it("resolves project-slug/N (no hash) via getTaskByProjectAndId", async () => {
    const client = makeClient("0resolved0OID0resolved01");
    expect(await resolveTaskOid(client, "my-proj/408")).toBe("0resolved0OID0resolved01");
    expect(client.getTaskByProjectAndId).toHaveBeenCalledWith("my-proj", "408");
  });

  it("resolves a full Quire task URL via parseQuireUrl + getTaskByProjectAndId", async () => {
    const client = makeClient("0resolved0OID0resolved01");
    expect(
      await resolveTaskOid(client, "https://quire.io/w/Quire_Dev_Test_Project/2"),
    ).toBe("0resolved0OID0resolved01");
    expect(client.getTaskByProjectAndId).toHaveBeenCalledWith("Quire_Dev_Test_Project", "2");
  });

  it("rejects non-task URLs", async () => {
    const client = makeClient();
    await expect(
      resolveTaskOid(client, "https://example.com/some/path"),
    ).rejects.toMatchObject({ name: "ValidationError", exitCode: 3 });
    expect(client.getTaskByProjectAndId).not.toHaveBeenCalled();
  });

  it("rejects bare #N (ambiguous without a project)", async () => {
    const client = makeClient();
    await expect(resolveTaskOid(client, "#408")).rejects.toMatchObject({
      name: "ValidationError",
      exitCode: 3,
    });
  });

  it("rejects unrecognized strings", async () => {
    const client = makeClient();
    await expect(resolveTaskOid(client, "not-a-real-id")).rejects.toMatchObject({
      name: "ValidationError",
      exitCode: 3,
    });
  });
});
