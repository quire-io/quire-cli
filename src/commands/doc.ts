import { Command } from "commander";
import { looksLikeOid, parseQuireUrl } from "@quire-io/api-client";
import type { QuireClient } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

async function resolveDocOid(client: QuireClient, input: string): Promise<string> {
  if (looksLikeOid(input)) return input;

  if (/^https?:\/\//i.test(input)) {
    const parsed = parseQuireUrl(input);
    if (parsed?.kind === "document") {
      const d = await client.getDocumentByProjectAndId(parsed.projectId, parsed.docId);
      return d.oid;
    }
    throw new ValidationError(`URL is not a Quire document: "${input}"`);
  }

  const slug = input.match(/^([^/]+)\/(.+)$/);
  if (slug) {
    const projectId = slug[1] as string;
    const docId = slug[2] as string;
    const d = await client.getDocumentByProjectAndId(projectId, docId);
    return d.oid;
  }

  throw new ValidationError(
    `Cannot resolve document: "${input}". Expected a doc OID, "project-slug/<doc-id>", or a full Quire document URL.`,
  );
}

export function registerDocCommand(program: Command): void {
  const doc = program.command("doc").description("Quire documents.");

  doc
    .command("list <project>")
    .description("List documents in a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const docs = await client.listDocuments("project", oid);
      renderList(docs, root, {
        columns: [
          { header: "ID", get: (d) => d.id },
          { header: "NAME", get: (d) => d.nameText ?? d.name },
          { header: "OID", get: (d) => d.oid },
        ],
        toId: (d) => d.oid,
      });
    });

  doc
    .command("get <id>")
    .description("Show document details. <id> = OID, project-slug/<doc-id>, or URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveDocOid(client, id);
      const d = await client.getDocument(oid);
      renderObject(d, root, {
        fields: [
          { label: "Name", get: (d) => d.nameText ?? d.name },
          { label: "ID", get: (d) => d.id },
          { label: "OID", get: (d) => d.oid },
          { label: "Description", get: (d) => d.descriptionText },
          { label: "URL", get: (d) => d.url },
        ],
        toId: (d) => d.oid,
      });
    });
}
