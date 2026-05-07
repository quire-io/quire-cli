import { Command } from "commander";
import { looksLikeOid, parseQuireUrl } from "@quire-io/api-client";
import type { QuireClient } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import { resolveTextInput } from "../util/text-input.js";

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

const CHAT_FIELDS = [
  { label: "Name", get: (c: { nameText?: string; name: string }) => c.nameText ?? c.name },
  { label: "ID", get: (c: { id: string }) => c.id },
  { label: "OID", get: (c: { oid: string }) => c.oid },
  { label: "Description", get: (c: { descriptionText?: string }) => c.descriptionText },
  { label: "URL", get: (c: { url?: string }) => c.url },
];

const CHAT_COMMENT_FIELDS = [
  { label: "OID", get: (c: { oid: string }) => c.oid },
  { label: "When", get: (c: { createdAt?: string }) => c.createdAt },
  { label: "Who", get: (c: { createdBy?: { name?: string } }) => c.createdBy?.name },
  { label: "Pinned at", get: (c: { pinAt?: string }) => c.pinAt },
  { label: "Text", get: (c: { descriptionText?: string }) => c.descriptionText },
  { label: "URL", get: (c: { url?: string }) => c.url },
];

async function resolveChatOid(client: QuireClient, input: string): Promise<string> {
  if (looksLikeOid(input)) return input;

  if (/^https?:\/\//i.test(input)) {
    const parsed = parseQuireUrl(input);
    if (parsed?.kind === "chat") {
      const c = await client.getChatByProjectAndId(parsed.projectId, parsed.chatId);
      return c.oid;
    }
    throw new ValidationError(`URL is not a Quire chat: "${input}"`);
  }

  const slug = input.match(/^([^/]+)\/(.+)$/);
  if (slug) {
    const projectId = slug[1] as string;
    const chatId = slug[2] as string;
    const c = await client.getChatByProjectAndId(projectId, chatId);
    return c.oid;
  }

  throw new ValidationError(
    `Cannot resolve chat: "${input}". Expected a chat OID, "project-slug/<chat-id>", or a full Quire chat URL.`,
  );
}

export function registerChatCommand(program: Command): void {
  const chat = program.command("chat").description("Quire chats.");

  chat
    .command("list <project>")
    .description("List chats in a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const chats = await client.listChats("project", oid);
      renderList(chats, root, {
        columns: [
          { header: "ID", get: (c) => c.id },
          { header: "NAME", get: (c) => c.nameText ?? c.name },
          { header: "OID", get: (c) => c.oid },
        ],
        toId: (c) => c.oid,
      });
    });

  chat
    .command("get <id>")
    .description("Show chat details. <id> = OID, project-slug/<chat-id>, or URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveChatOid(client, id);
      const c = await client.getChat(oid);
      renderObject(c, root, { fields: CHAT_FIELDS, toId: (c) => c.oid });
    });

  chat
    .command("comments <id>")
    .description("List comments in a chat. <id> = OID, project-slug/<chat-id>, or URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveChatOid(client, id);
      const comments = await client.listChatComments(oid);
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

  chat
    .command("create <project>")
    .description("Create a chat in a project.")
    .requiredOption("--name <name>", "Chat name (required)")
    .option("--description <text>", "Description; '-' for stdin or '@file' for a file")
    .option("--partner <oid>", "Partner OID, if this is a partner chat")
    .action(async (project: string, cmdOpts: { name: string; description?: string; partner?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const c = await client.createChat("project", projectOid, {
        name: cmdOpts.name,
        ...(description !== undefined ? { description } : {}),
        ...(cmdOpts.partner !== undefined ? { partner: cmdOpts.partner } : {}),
      });
      renderObject(c, root, { fields: CHAT_FIELDS, toId: (c) => c.oid });
    });

  chat
    .command("update <oid>")
    .description("Update a chat.")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description ('-' = stdin, '@file' = file)")
    .option("--archive", "Archive the chat")
    .option("--unarchive", "Unarchive the chat")
    .option("--add-follower <user>", "Add follower; repeat for multiple", append, [] as string[])
    .option("--remove-follower <user>", "Remove follower; repeat for multiple", append, [] as string[])
    .action(async (oid: string, cmdOpts: {
      name?: string; description?: string;
      archive?: boolean; unarchive?: boolean;
      addFollower?: string[]; removeFollower?: string[];
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (cmdOpts.archive === true && cmdOpts.unarchive === true) {
        throw new ValidationError("Cannot combine --archive and --unarchive.");
      }
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const body: { name?: string; description?: string; archived?: boolean; addFollowers?: string[]; removeFollowers?: string[] } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (description !== undefined) body.description = description;
      if (cmdOpts.archive === true) body.archived = true;
      if (cmdOpts.unarchive === true) body.archived = false;
      if ((cmdOpts.addFollower?.length ?? 0) > 0) body.addFollowers = cmdOpts.addFollower;
      if ((cmdOpts.removeFollower?.length ?? 0) > 0) body.removeFollowers = cmdOpts.removeFollower;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`chat update` requires at least one of --name / --description / --archive / --unarchive / --add-follower / --remove-follower.");
      }
      const c = await client.updateChat(oid, body);
      renderObject(c, root, { fields: CHAT_FIELDS, toId: (c) => c.oid });
    });

  chat
    .command("delete <oid>")
    .description("Delete a chat. Prompts unless --yes.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      await confirmDestructive({
        question: `Delete chat ${oid}? Run \`quire chat undo-remove ${oid}\` (or \`quire undo chat ${oid}\`) to restore.`,
        yes: root.yes,
      });
      await client.deleteChat(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted chat ${oid}.\n`);
      }
    });

  chat
    .command("undo-remove <oid>")
    .description("Restore a deleted chat.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const c = await client.undoRemoveChat(oid);
      renderObject(c, root, { fields: CHAT_FIELDS, toId: (c) => c.oid });
    });

  // -------- Chat comments (Phase 5.4) --------

  const chatComment = chat
    .command("comment")
    .description("Manage comments inside a chat.");

  chatComment
    .command("add <chat-id>")
    .description("Post a comment to a chat. --text accepts '-' (stdin) or '@file'.")
    .requiredOption("--text <text>", "Comment text; '-' for stdin or '@file' to read from disk.")
    .option("--pin", "Pin the comment after creating it")
    .action(async (chatId: string, cmdOpts: { text: string; pin?: boolean }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await resolveChatOid(client, chatId);
      const description = await resolveTextInput(cmdOpts.text);
      const c = await client.addChatComment(oid, {
        description,
        ...(cmdOpts.pin === true ? { pinned: true } : {}),
      });
      renderObject(c, root, { fields: CHAT_COMMENT_FIELDS, toId: (c) => c.oid });
    });
}
