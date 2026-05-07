import { Command } from "commander";
import { parseQuireUrl } from "@quire-io/api-client";
import type {
  QuireChat,
  QuireDocument,
  QuireOrganization,
  QuireProject,
  QuireTask,
  QuireUser,
} from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { createQuireClient } from "../quire-client.js";

type Resolved =
  | { kind: "organization"; resource: QuireOrganization }
  | { kind: "project"; resource: QuireProject }
  | { kind: "task"; resource: QuireTask }
  | { kind: "chat"; resource: QuireChat }
  | { kind: "document"; resource: QuireDocument }
  | { kind: "user"; resource: QuireUser };

function commonName(r: Resolved["resource"]): string {
  return (r as { nameText?: string; name: string }).nameText ?? r.name;
}

export function registerResolveCommand(program: Command): void {
  program
    .command("resolve <url>")
    .description(
      "Resolve a Quire URL into the typed resource (organization / project / task / chat / document / user).",
    )
    .action(async (url: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      const parsed = parseQuireUrl(url);
      if (!parsed) {
        throw new ValidationError(`Not a recognized Quire URL: "${url}"`);
      }

      let result: Resolved;
      switch (parsed.kind) {
        case "organization":
          result = { kind: "organization", resource: await client.getOrganizationById(parsed.orgId) };
          break;
        case "project":
          result = { kind: "project", resource: await client.getProjectById(parsed.projectId) };
          break;
        case "task":
          result = { kind: "task", resource: await client.getTaskByProjectAndId(parsed.projectId, parsed.taskId) };
          break;
        case "chat":
          result = { kind: "chat", resource: await client.getChatByProjectAndId(parsed.projectId, parsed.chatId) };
          break;
        case "document":
          result = { kind: "document", resource: await client.getDocumentByProjectAndId(parsed.projectId, parsed.docId) };
          break;
        case "user":
          result = { kind: "user", resource: await client.getUserById(parsed.userId) };
          break;
      }

      if (root.json === true) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
      }
      if (root.quiet === true) {
        process.stdout.write(`${result.resource.oid}\n`);
        return;
      }

      const lines: string[] = [
        `Kind  ${result.kind}`,
        `Name  ${commonName(result.resource)}`,
      ];
      const id = (result.resource as { id?: string | number }).id;
      if (id !== undefined) lines.push(`ID    ${result.kind === "task" ? `#${id}` : String(id)}`);
      lines.push(`OID   ${result.resource.oid}`);
      const resourceUrl = (result.resource as { url?: string }).url;
      if (resourceUrl) lines.push(`URL   ${resourceUrl}`);

      process.stdout.write(`${lines.join("\n")}\n`);
    });
}
