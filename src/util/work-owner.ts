/**
 * `--owner-type` for the records that can live on a project, an organization,
 * a folder or a smart folder: dashboards, and insights since api-client 1.2.0.
 * (Reminders take the same four plus `task` and keep their own copy.)
 */
import type { QuireClient } from "@quire-io/api-client";
import { looksLikeOid } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";

export const WORK_OWNER_TYPES = ["project", "organization", "folder", "smart-folder"] as const;

export type WorkOwnerType = (typeof WORK_OWNER_TYPES)[number];

export const OWNER_TYPE_HELP = `Owner type: ${WORK_OWNER_TYPES.join(" | ")} (default: project)`;

export function parseOwnerType(input: string | undefined): WorkOwnerType {
  const type = input ?? "project";
  if (!(WORK_OWNER_TYPES as readonly string[]).includes(type)) {
    throw new ValidationError(
      `--owner-type must be one of ${WORK_OWNER_TYPES.join(", ")}; got "${type}".`,
    );
  }
  return type as WorkOwnerType;
}

// Folders and smart-folders have no slug-resolution endpoint, so those owners
// must be passed as OIDs.
export async function resolveOwnerOid(
  client: QuireClient,
  ownerType: WorkOwnerType,
  input: string,
): Promise<string> {
  if (ownerType === "project") return client.resolveProjectOid(input);
  if (ownerType === "organization") return client.resolveOrgOid(input);
  if (!looksLikeOid(input)) {
    throw new ValidationError(
      `Owner type "${ownerType}" requires an OID; got "${input}".`,
    );
  }
  return input;
}
