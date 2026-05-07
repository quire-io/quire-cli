import { describe, expect, it } from "vitest";

import { resolveLiveClient } from "./_setup.js";

const { client, skip, reason } = resolveLiveClient();
if (skip) console.warn(`[live] skipping org.live: ${reason ?? ""}`);

describe.skipIf(skip)("live: org endpoints", () => {
  it("resolveOrgOid round-trips slug → oid → getOrganization", async () => {
    const orgs = await client!.listOrganizations();
    const sample = orgs[0]!;
    const resolved = await client!.resolveOrgOid(sample.id);
    expect(resolved).toBe(sample.oid);

    const detail = await client!.getOrganization(resolved);
    expect(detail.oid).toBe(sample.oid);
    expect(typeof detail.name).toBe("string");
  });

  it("getRateLimit returns minute + hour buckets with sane numbers", async () => {
    const orgs = await client!.listOrganizations();
    const limit = await client!.getRateLimit(orgs[0]!.oid);
    for (const bucket of [limit.minute, limit.hour]) {
      expect(bucket.limit).toBeGreaterThan(0);
      expect(bucket.used).toBeGreaterThanOrEqual(0);
      expect(bucket.remaining).toBeGreaterThanOrEqual(0);
      expect(bucket.used + bucket.remaining).toBeLessThanOrEqual(bucket.limit);
      expect(typeof bucket.reset).toBe("number");
    }
  });
});
