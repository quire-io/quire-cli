import { Command } from "commander";
import { looksLikeOid, parseQuireUrl } from "@quire-io/api-client";
import type { QuireClient } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

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
      renderObject(c, root, {
        fields: [
          { label: "Name", get: (c) => c.nameText ?? c.name },
          { label: "ID", get: (c) => c.id },
          { label: "OID", get: (c) => c.oid },
          { label: "Description", get: (c) => c.descriptionText },
          { label: "URL", get: (c) => c.url },
        ],
        toId: (c) => c.oid,
      });
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
}
