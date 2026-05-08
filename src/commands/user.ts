import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";

const USER_FIELDS = [
  { label: "Name", get: (u: { nameText?: string; name: string }) => u.nameText ?? u.name },
  { label: "ID", get: (u: { id: string }) => u.id },
  { label: "OID", get: (u: { oid: string }) => u.oid },
  { label: "Email", get: (u: { email?: string }) => u.email },
  { label: "Description", get: (u: { descriptionText?: string }) => u.descriptionText },
  { label: "Website", get: (u: { website?: string }) => u.website },
  { label: "URL", get: (u: { url?: string }) => u.url },
];

export function registerUserCommand(program: Command): void {
  const user = program.command("user").description("Quire users.");

  user
    .command("get <oid>")
    .description("Show one user by OID. Use `quire whoami` for the signed-in user; `quire resolve <url>` for a public-id URL.")
    .action(async (oid: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const u = await client.getUser(oid);
      renderObject(u, root, { fields: USER_FIELDS, toId: (u) => u.oid });
    });
}
