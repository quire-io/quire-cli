import { Command } from "commander";
import { looksLikeOid, parseQuireUrl } from "@quire-io/api-client";
import type { QuireClient } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import { resolveTextInput } from "../util/text-input.js";

const DOC_FIELDS = [
  { label: "Name", get: (d: { nameText?: string; name: string }) => d.nameText ?? d.name },
  { label: "ID", get: (d: { id: string }) => d.id },
  { label: "OID", get: (d: { oid: string }) => d.oid },
  { label: "Description", get: (d: { descriptionText?: string }) => d.descriptionText },
  { label: "URL", get: (d: { url?: string }) => d.url },
];

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
      renderObject(d, root, { fields: DOC_FIELDS, toId: (d) => d.oid });
    });

  doc
    .command("create <project>")
    .description("Create a document in a project. --description accepts '-' (stdin) or '@file'.")
    .requiredOption("--name <name>", "Document name (required)")
    .option("--description <text>", "Document description; '-' for stdin or '@file' for a file")
    .action(async (project: string, cmdOpts: { name: string; description?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const d = await client.createDocument("project", projectOid, {
        name: cmdOpts.name,
        ...(description !== undefined ? { description } : {}),
      });
      renderObject(d, root, { fields: DOC_FIELDS, toId: (d) => d.oid });
    });

  doc
    .command("update <oid>")
    .description("Update a document.")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description ('-' for stdin, '@file' for a file)")
    .option("--archive", "Archive the document")
    .option("--unarchive", "Unarchive the document")
    .action(async (oid: string, cmdOpts: { name?: string; description?: string; archive?: boolean; unarchive?: boolean }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (cmdOpts.archive === true && cmdOpts.unarchive === true) {
        throw new ValidationError("Cannot combine --archive and --unarchive.");
      }
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const body: { name?: string; description?: string; archived?: boolean } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (description !== undefined) body.description = description;
      if (cmdOpts.archive === true) body.archived = true;
      if (cmdOpts.unarchive === true) body.archived = false;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`doc update` requires at least one of --name / --description / --archive / --unarchive.");
      }
      const d = await client.updateDocument(oid, body);
      renderObject(d, root, { fields: DOC_FIELDS, toId: (d) => d.oid });
    });

  doc
    .command("delete <oid>")
    .description("Delete a document. Prompts unless --yes.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      await confirmDestructive({
        question: `Delete document ${oid}? Run \`quire doc undo-remove ${oid}\` (or \`quire undo document ${oid}\`) to restore.`,
        yes: root.yes,
      });
      await client.deleteDocument(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted document ${oid}.\n`);
      }
    });

  doc
    .command("undo-remove <oid>")
    .description("Restore a deleted document.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const d = await client.undoRemoveDocument(oid);
      renderObject(d, root, { fields: DOC_FIELDS, toId: (d) => d.oid });
    });
}
