import { describe, expect, it } from "vitest";

import { resolveLiveClient } from "./_setup.js";

const { client, skip, reason } = resolveLiveClient();
if (skip) console.warn(`[live] skipping auth.live: ${reason ?? ""}`);

describe.skipIf(skip)("live: auth + identity", () => {
  it("getMe returns the signed-in user with required fields", async () => {
    const me = await client!.getMe();
    expect(me.oid).toMatch(/^[A-Za-z0-9._~-]{24}$/);
    expect(typeof me.id).toBe("string");
    expect(typeof me.name).toBe("string");
    expect(me.email).toMatch(/@/);
  });

  it("listOrganizations returns at least one org with required fields", async () => {
    const orgs = await client!.listOrganizations();
    expect(orgs.length).toBeGreaterThan(0);
    for (const o of orgs) {
      expect(o.oid).toMatch(/^[A-Za-z0-9._~-]{24}$/);
      expect(typeof o.id).toBe("string");
      expect(typeof o.name).toBe("string");
    }
  });
});
