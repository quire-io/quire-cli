import { Command } from "commander";
import { resolveColor } from "@quire-io/api-client";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { longColor, shortColor } from "../output/colors.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";

function normalizeColor(input: string | undefined, required: boolean): string | undefined {
  if (input === undefined) {
    if (required) throw new ValidationError("--color is required.");
    return undefined;
  }
  const code = resolveColor(input);
  if (code === undefined) {
    throw new ValidationError(
      `Color "${input}" is not a recognized palette name or code. Use a name like 'red'/'blue'/'green' or a 2-digit code '00'..'57'.`,
    );
  }
  return code;
}

function parseStatusValue(input: string, label: string): number {
  const n = Number.parseInt(input, 10);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new ValidationError(`${label} must be an integer 0-100; got "${input}"`);
  }
  return n;
}

const STATUS_FIELDS = [
  { label: "Name", get: (s: { name: string }) => s.name },
  { label: "Value", get: (s: { value: number }) => String(s.value) },
  { label: "Color", get: (s: { color?: string }) => longColor(s.color) },
  { label: "OID", get: (s: { oid?: string }) => s.oid },
];

export function registerStatusCommand(program: Command): void {
  const status = program.command("status").description("Quire workflow statuses.");

  status
    .command("list <project>")
    .description("List custom workflow statuses on a project. <project> = OID, slug, or URL.")
    .action(async (project: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(project);
      const statuses = await client.listStatuses(oid);
      renderList(statuses, root, {
        columns: [
          { header: "VALUE", get: (s) => String(s.value) },
          { header: "NAME", get: (s) => s.name },
          { header: "COLOR", get: (s) => shortColor(s.color) },
          { header: "OID", get: (s) => s.oid ?? "" },
        ],
        toId: (s) => s.oid ?? String(s.value),
      });
    });

  status
    .command("create <project>")
    .description("Create a custom status on a project.")
    .requiredOption("--name <name>", "Status name (required)")
    .requiredOption("--value <n>", "Numeric value 0-100 (required)")
    .requiredOption("--color <color>", "Color: name or 2-digit code (required)")
    .action(async (project: string, cmdOpts: { name: string; value: string; color: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const value = parseStatusValue(cmdOpts.value, "--value");
      const color = normalizeColor(cmdOpts.color, true) as string;
      const s = await client.createStatus(projectOid, { name: cmdOpts.name, color, value });
      renderObject(s, root, { fields: STATUS_FIELDS, toId: (s) => s.oid ?? String(s.value) });
    });

  status
    .command("update <project> <value>")
    .description("Update a status. <value> = current numeric value (use --new-value to change it).")
    .option("--name <name>", "New name")
    .option("--color <color>", "New color")
    .option("--new-value <n>", "Move the status to a new numeric slot")
    .action(async (project: string, valueArg: string, cmdOpts: { name?: string; color?: string; newValue?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const value = parseStatusValue(valueArg, "<value>");
      const color = normalizeColor(cmdOpts.color, false);
      const newValue = cmdOpts.newValue !== undefined
        ? parseStatusValue(cmdOpts.newValue, "--new-value")
        : undefined;

      const body: { name?: string; color?: string; value?: number } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (color !== undefined) body.color = color;
      if (newValue !== undefined) body.value = newValue;
      if (Object.keys(body).length === 0) {
        throw new ValidationError("`status update` requires at least one of --name / --color / --new-value.");
      }

      const s = await client.updateStatus(projectOid, value, body);
      renderObject(s, root, { fields: STATUS_FIELDS, toId: (s) => s.oid ?? String(s.value) });
    });

  status
    .command("delete <project> <value>")
    .description("Delete a status from a project. Prompts unless --yes is set.")
    .action(async (project: string, valueArg: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(project);
      const value = parseStatusValue(valueArg, "<value>");
      await confirmDestructive({
        question: `Delete status ${value} from project ${projectOid}? Tasks that use it will need to be re-mapped.`,
        yes: root.yes,
      });
      await client.deleteStatus(projectOid, value);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ project: projectOid, value, deleted: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${value}\n`);
      } else {
        process.stderr.write(`Deleted status ${value} from project ${projectOid}.\n`);
      }
    });
}
