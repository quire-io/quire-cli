import { Command } from "commander";
import { looksLikeOid, resolveColor } from "@quire-io/api-client";
import type { QuireClient, QuireDashboardOwnerType } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";
import { resolveTextInput } from "../util/text-input.js";

const OWNER_TYPES = ["project", "organization", "folder", "smart-folder"] as const;

function parseOwnerType(input: string | undefined): QuireDashboardOwnerType {
  const type = input ?? "project";
  if (!(OWNER_TYPES as readonly string[]).includes(type)) {
    throw new ValidationError(
      `--owner-type must be one of ${OWNER_TYPES.join(", ")}; got "${type}".`,
    );
  }
  return type as QuireDashboardOwnerType;
}

// Folders and smart-folders have no slug-resolution endpoint, so those owners
// must be passed as OIDs.
async function resolveOwnerOid(
  client: QuireClient,
  ownerType: QuireDashboardOwnerType,
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

function normalizeDashboardColor(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  const code = resolveColor(input);
  if (code === undefined) {
    throw new ValidationError(
      `Color "${input}" is not a recognized palette name or code. Use a name like 'red'/'blue' or a 2-digit code '00'..'57'.`,
    );
  }
  return code;
}

const DASHBOARD_FIELDS = [
  { label: "Name", get: (d: { nameText?: string; name: string }) => d.nameText ?? d.name },
  { label: "ID", get: (d: { id: string }) => d.id },
  { label: "OID", get: (d: { oid: string }) => d.oid },
  { label: "Description", get: (d: { descriptionText?: string }) => d.descriptionText },
  { label: "Icon color", get: (d: { iconColor?: string }) => d.iconColor },
  { label: "Start", get: (d: { start?: string }) => d.start },
  { label: "Due", get: (d: { due?: string }) => d.due },
  { label: "Archived at", get: (d: { archivedAt?: string }) => d.archivedAt },
  { label: "URL", get: (d: { url?: string }) => d.url },
];

export function registerDashboardCommand(program: Command): void {
  const dashboard = program.command("dashboard").description("Quire dashboards.");

  dashboard
    .command("list <owner>")
    .description("List dashboards on an owner. <owner> = OID, slug, or URL (projects / orgs); folders need an OID.")
    .option("--owner-type <type>", `Owner type: ${OWNER_TYPES.join(" | ")} (default: project)`)
    .action(async (owner: string, cmdOpts: { ownerType?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const ownerType = parseOwnerType(cmdOpts.ownerType);
      const ownerOid = await resolveOwnerOid(client, ownerType, owner);
      const dashboards = await client.listDashboards(ownerType, ownerOid);
      renderList(dashboards, root, {
        columns: [
          { header: "ID", get: (d) => d.id },
          { header: "NAME", get: (d) => d.nameText ?? d.name },
          { header: "OID", get: (d) => d.oid },
        ],
        toId: (d) => d.oid,
      });
    });

  dashboard
    .command("get <id>")
    .description("Show dashboard details. <id> = OID or \"owner-id/<dashboard-id>\" (owner id per --owner-type).")
    .option("--owner-type <type>", `Owner type for the slug form: ${OWNER_TYPES.join(" | ")} (default: project)`)
    .action(async (id: string, cmdOpts: { ownerType?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (looksLikeOid(id)) {
        const d = await client.getDashboard(id);
        renderObject(d, root, { fields: DASHBOARD_FIELDS, toId: (d) => d.oid });
        return;
      }
      const slug = id.match(/^([^/]+)\/(.+)$/);
      if (slug) {
        const ownerType = parseOwnerType(cmdOpts.ownerType);
        const d = await client.getDashboardById(ownerType, slug[1] as string, slug[2] as string);
        renderObject(d, root, { fields: DASHBOARD_FIELDS, toId: (d) => d.oid });
        return;
      }
      throw new ValidationError(
        `Cannot resolve dashboard: "${id}". Expected a dashboard OID or "owner-id/<dashboard-id>".`,
      );
    });

  dashboard
    .command("create <owner>")
    .description("Create a dashboard on an owner (project by default).")
    .requiredOption("--name <name>", "Dashboard name (required)")
    .option("--owner-type <type>", `Owner type: ${OWNER_TYPES.join(" | ")} (default: project)`)
    .option("--id <id>", "Caller-supplied id (must pass Quire's isValidId)")
    .option("--description <text>", "Description; '-' for stdin or '@file' for a file")
    .option("--icon-color <color>", "Color: name like 'red'/'blue' or 2-digit code")
    .option("--image <url>", "Icon image URL")
    .option("--partner <oid>", "Partner OID, if this is a partner dashboard")
    .option("--start <date>", "Start date")
    .option("--due <date>", "Due date")
    .action(async (owner: string, cmdOpts: {
      name: string; ownerType?: string; id?: string; description?: string;
      iconColor?: string; image?: string; partner?: string; start?: string; due?: string;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const ownerType = parseOwnerType(cmdOpts.ownerType);
      const ownerOid = await resolveOwnerOid(client, ownerType, owner);
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const iconColor = normalizeDashboardColor(cmdOpts.iconColor);
      const d = await client.createDashboard(ownerType, ownerOid, {
        name: cmdOpts.name,
        ...(cmdOpts.id !== undefined ? { id: cmdOpts.id } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(iconColor !== undefined ? { iconColor } : {}),
        ...(cmdOpts.image !== undefined ? { image: cmdOpts.image } : {}),
        ...(cmdOpts.partner !== undefined ? { partner: cmdOpts.partner } : {}),
        ...(cmdOpts.start !== undefined ? { start: cmdOpts.start } : {}),
        ...(cmdOpts.due !== undefined ? { due: cmdOpts.due } : {}),
      });
      renderObject(d, root, { fields: DASHBOARD_FIELDS, toId: (d) => d.oid });
    });

  dashboard
    .command("update <oid>")
    .description("Update a dashboard. Pass 'null' to --start / --due to clear the date.")
    .option("--id <id>", "New id")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description ('-' = stdin, '@file' = file)")
    .option("--icon-color <color>")
    .option("--image <url>")
    .option("--start <date>", "Start date or 'null' to clear")
    .option("--due <date>", "Due date or 'null' to clear")
    .option("--archive", "Archive the dashboard")
    .option("--unarchive", "Unarchive the dashboard")
    .action(async (oid: string, cmdOpts: {
      id?: string; name?: string; description?: string; iconColor?: string; image?: string;
      start?: string; due?: string; archive?: boolean; unarchive?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      if (cmdOpts.archive === true && cmdOpts.unarchive === true) {
        throw new ValidationError("Cannot combine --archive and --unarchive.");
      }
      const description = cmdOpts.description !== undefined ? await resolveTextInput(cmdOpts.description) : undefined;
      const iconColor = normalizeDashboardColor(cmdOpts.iconColor);
      const body: {
        id?: string; name?: string; description?: string; iconColor?: string; image?: string;
        start?: string | null; due?: string | null; archived?: boolean;
      } = {};
      if (cmdOpts.id !== undefined) body.id = cmdOpts.id;
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (description !== undefined) body.description = description;
      if (iconColor !== undefined) body.iconColor = iconColor;
      if (cmdOpts.image !== undefined) body.image = cmdOpts.image;
      if (cmdOpts.start !== undefined) body.start = cmdOpts.start === "null" ? null : cmdOpts.start;
      if (cmdOpts.due !== undefined) body.due = cmdOpts.due === "null" ? null : cmdOpts.due;
      if (cmdOpts.archive === true) body.archived = true;
      if (cmdOpts.unarchive === true) body.archived = false;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`dashboard update` requires at least one change-flag.");
      }
      const d = await client.updateDashboard(oid, body);
      renderObject(d, root, { fields: DASHBOARD_FIELDS, toId: (d) => d.oid });
    });

  dashboard
    .command("delete <oid>")
    .description("Delete a dashboard. Prompts unless --yes.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      await confirmDestructive({
        question: `Delete dashboard ${oid}? Run \`quire dashboard undo-remove ${oid}\` (or \`quire undo dashboard ${oid}\`) to restore.`,
        yes: root.yes,
      });
      await client.deleteDashboard(oid);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ oid, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${oid}\n`);
      } else {
        process.stderr.write(`Deleted dashboard ${oid}.\n`);
      }
    });

  dashboard
    .command("undo-remove <oid>")
    .description("Restore a deleted dashboard.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const d = await client.undoRemoveDashboard(oid);
      renderObject(d, root, { fields: DASHBOARD_FIELDS, toId: (d) => d.oid });
    });
}
