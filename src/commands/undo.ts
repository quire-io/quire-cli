import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { TASK_GET_FIELDS } from "../output/columns.js";
import { renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

const VALID_KINDS = [
  "task",
  "chat",
  "comment",
  "document",
  "insight",
  "sublist",
] as const;

type Kind = (typeof VALID_KINDS)[number];

// Render-shape covering every undo target — chat / comment / document /
// insight / sublist — without forcing each call site to declare its own
// field set. Each `get` reads optionally; comments don't have name/id, etc.
type GenericResource = {
  oid: string;
  id?: string | number;
  name?: string;
  nameText?: string;
  url?: string;
  descriptionText?: string;
};

const GENERIC_FIELDS = [
  { label: "Name", get: (r: GenericResource) => r.nameText ?? r.name },
  { label: "ID", get: (r: GenericResource) => (r.id !== undefined ? String(r.id) : undefined) },
  { label: "OID", get: (r: GenericResource) => r.oid },
  { label: "Description", get: (r: GenericResource) => r.descriptionText },
  { label: "URL", get: (r: GenericResource) => r.url },
];

export function registerUndoCommand(program: Command): void {
  program
    .command("undo <kind> <oid>")
    .description(
      `Restore a deleted resource. <kind> = ${VALID_KINDS.join(" | ")}. Mirrors the per-resource \`undo-remove\` subcommands.`,
    )
    .action(async (kind: string, oid: string) => {
      if (!(VALID_KINDS as readonly string[]).includes(kind)) {
        throw new ValidationError(
          `Unknown kind "${kind}". Expected one of: ${VALID_KINDS.join(", ")}.`,
        );
      }
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });

      switch (kind as Kind) {
        case "task": {
          const t = await client.undoRemoveTask(oid);
          renderObject(t, root, { fields: TASK_GET_FIELDS, toId: (t) => t.oid });
          return;
        }
        case "chat": {
          const c = await client.undoRemoveChat(oid);
          renderObject(c as GenericResource, root, { fields: GENERIC_FIELDS, toId: (r) => r.oid });
          return;
        }
        case "comment": {
          const c = await client.undoRemoveComment(oid);
          renderObject(c as GenericResource, root, { fields: GENERIC_FIELDS, toId: (r) => r.oid });
          return;
        }
        case "document": {
          const d = await client.undoRemoveDocument(oid);
          renderObject(d, root, { fields: GENERIC_FIELDS, toId: (d) => d.oid });
          return;
        }
        case "insight": {
          const i = await client.undoRemoveInsight(oid);
          renderObject(i, root, { fields: GENERIC_FIELDS, toId: (i) => i.oid });
          return;
        }
        case "sublist": {
          const s = await client.undoRemoveSublist(oid);
          renderObject(s, root, { fields: GENERIC_FIELDS, toId: (s) => s.oid });
          return;
        }
      }
    });
}
