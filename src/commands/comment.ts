import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { resolveAttachInput } from "../util/attach-input.js";
import { confirmDestructive } from "../util/confirm.js";
import { resolveTaskOid } from "../util/task-id.js";
import { resolveTextInput } from "../util/text-input.js";

const COMMENT_FIELDS = [
  { label: "OID", get: (c: { oid: string }) => c.oid },
  { label: "When", get: (c: { createdAt?: string }) => c.createdAt },
  { label: "Who", get: (c: { createdBy?: { name?: string } }) => c.createdBy?.name },
  { label: "Pinned at", get: (c: { pinAt?: string }) => c.pinAt },
  { label: "Text", get: (c: { descriptionText?: string }) => c.descriptionText },
  { label: "URL", get: (c: { url?: string }) => c.url },
];

const ATTACHMENT_FIELDS = [
  { label: "Name", get: (a: { name: string }) => a.name },
  { label: "URL", get: (a: { url: string }) => a.url },
  { label: "Length", get: (a: { length: number }) => String(a.length) },
  { label: "Created at", get: (a: { createdAt?: string }) => a.createdAt },
];

export function registerCommentCommand(program: Command): void {
  const comment = program.command("comment").description("Quire task comments.");

  comment
    .command("list <task-id>")
    .description("List comments on a task. <task-id> = OID, project-slug/#408, or URL.")
    .action(async (taskId: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, taskId);
      const comments = await client.getTaskComments(oid);
      renderList(comments, root, {
        columns: [
          {
            header: "WHEN",
            get: (c) => (c as { createdAt?: string }).createdAt ?? "",
          },
          { header: "WHO", get: (c) => c.createdBy?.name ?? "" },
          {
            header: "TEXT",
            get: (c) => (c.descriptionText ?? "").replace(/\s+/g, " ").trim(),
          },
          { header: "OID", get: (c) => c.oid },
        ],
        toId: (c) => c.oid,
      });
    });

  comment
    .command("add <task-id>")
    .description("Add a comment to a task. --text accepts '-' (stdin) or '@file' for long content.")
    .requiredOption("--text <text>", "Comment text; use '-' for stdin or '@/path/to/file' to read from disk.")
    .action(async (taskId: string, cmdOpts: { text: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveTaskOid(client, taskId);
      const text = await resolveTextInput(cmdOpts.text);
      const c = await client.addComment(oid, text);
      renderObject(c, root, { fields: COMMENT_FIELDS, toId: (c) => c.oid });
    });

  comment
    .command("update <oid>")
    .description("Update a comment. Pass --text to change the body, --pin / --unpin to toggle pinned.")
    .option("--text <text>", "New comment text; '-' for stdin or '@file' for a file.")
    .option("--pin", "Pin the comment.")
    .option("--unpin", "Unpin the comment.")
    .action(async (oid: string, cmdOpts: { text?: string; pin?: boolean; unpin?: boolean }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      if (cmdOpts.pin === true && cmdOpts.unpin === true) {
        throw new ValidationError("Cannot combine --pin and --unpin.");
      }

      const body: { description?: string; pinned?: boolean } = {};
      if (cmdOpts.text !== undefined) body.description = await resolveTextInput(cmdOpts.text);
      if (cmdOpts.pin === true) body.pinned = true;
      if (cmdOpts.unpin === true) body.pinned = false;

      if (body.description === undefined && body.pinned === undefined) {
        throw new ValidationError("`comment update` requires at least one of --text / --pin / --unpin.");
      }

      const c = await client.updateComment(oid, body);
      renderObject(c, root, { fields: COMMENT_FIELDS, toId: (c) => c.oid });
    });

  comment
    .command("attach <oid> <file>")
    .description("Attach a file to a comment. <file> = path on disk, or '-' to read bytes from stdin (then --filename is required).")
    .option("--filename <name>", "Server-side filename (defaults to the basename of <file>; required when <file> = '-')")
    .option("--content-type <mime>", "Content-Type header (defaults to extension-based guess; falls back to application/octet-stream)")
    .action(async (oid: string, file: string, cmdOpts: { filename?: string; contentType?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const input = await resolveAttachInput(file, cmdOpts);
      const a = await client.attachCommentFile(oid, input.filename, input.bytes, input.contentType);
      renderObject(a, root, { fields: ATTACHMENT_FIELDS, toId: (a) => a.url });
    });

  comment
    .command("delete <oid>")
    .description("Delete a comment. Prompts for confirmation unless --yes is set.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      await confirmDestructive({
        question: `Delete comment ${oid}? Run \`quire undo comment ${oid}\` to restore (Phase 5.5).`,
        yes: root.yes,
      });

      await client.deleteComment(oid);

      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted comment ${oid}.\n`);
      }
    });
}
