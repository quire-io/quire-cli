import { afterAll, describe, expect, it } from "vitest";

import { resolveLiveClient } from "./_setup.js";

/**
 * Canary write: create a task, fetch it back, then delete it. Gated on
 * `QUIRE_TEST_PROJECT_OID` so a clean checkout never accidentally writes
 * to your real account.
 *
 * The created task name is timestamped so it's easy to spot if the delete
 * step fails for any reason (then you can clean it up manually).
 */
const { client, skip: noClient, reason } = resolveLiveClient();
const projectOid = process.env.QUIRE_TEST_PROJECT_OID?.trim();
const skip = noClient || !projectOid;
const skipReason = noClient
  ? reason
  : "QUIRE_TEST_PROJECT_OID not set — skipping write canary";
if (skip) console.warn(`[live] skipping task-write.live: ${skipReason ?? ""}`);

describe.skipIf(skip)("live: task create + delete canary", () => {
  let createdOid: string | undefined;

  afterAll(async () => {
    if (createdOid) {
      try {
        await client!.deleteTask(createdOid);
      } catch (err) {
        console.error(`[live] failed to clean up canary task ${createdOid}:`, err);
      }
    }
  });

  it("creates a task, reads it back, and deletes it", async () => {
    const name = `quire-cli live test ${new Date().toISOString()}`;
    const created = await client!.createTask(projectOid!, { name });
    createdOid = created.oid;

    expect(created.oid).toMatch(/^[A-Za-z0-9._~-]{24}$/);
    expect(created.nameText ?? created.name).toBe(name);

    const fetched = await client!.getTask(created.oid);
    expect(fetched.oid).toBe(created.oid);

    await client!.deleteTask(created.oid);
    createdOid = undefined;
  });
});
