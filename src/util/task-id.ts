import { looksLikeOid, parseQuireUrl } from "@quire-io/api-client";
import type { QuireClient } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";

/**
 * Resolve a user-supplied task identifier into a Quire task OID. Accepted
 * forms:
 *   - bare OID (passes `looksLikeOid`)
 *   - `project-slug/#408` or `project-slug/408`
 *   - full Quire task URL (parsed via `parseQuireUrl`)
 *
 * Bare numeric IDs like `#408` aren't accepted because they're ambiguous
 * — they need a project context to disambiguate. Surfaced as a clean
 * `ValidationError` so the caller exits 3 with a helpful message.
 */
export async function resolveTaskOid(client: QuireClient, input: string): Promise<string> {
  if (looksLikeOid(input)) return input;

  if (/^https?:\/\//i.test(input)) {
    const parsed = parseQuireUrl(input);
    if (parsed?.kind === "task") {
      const task = await client.getTaskByProjectAndId(parsed.projectId, parsed.taskId);
      return task.oid;
    }
    throw new ValidationError(`URL is not a Quire task: "${input}"`);
  }

  const slugMatch = input.match(/^([^/]+)\/#?(\d+)$/);
  if (slugMatch) {
    const projectId = slugMatch[1] as string;
    const taskId = slugMatch[2] as string;
    const task = await client.getTaskByProjectAndId(projectId, taskId);
    return task.oid;
  }

  throw new ValidationError(
    `Cannot resolve task: "${input}". Expected a task OID, "project-slug/#408", or a full Quire task URL.`,
  );
}
