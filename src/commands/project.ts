import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { renderList, renderObject } from "../output/render.js";
import { createQuireClient } from "../quire-client.js";
import { confirmDestructive } from "../util/confirm.js";

const APPROVAL_CATEGORY_FIELDS = [
  { label: "ID", get: (c: { id: string }) => c.id },
  { label: "Name", get: (c: { name: string }) => c.name },
  {
    label: "Claimers",
    get: (c: { claimers?: string[] }) =>
      c.claimers === undefined ? "(anyone)" : c.claimers.length === 0 ? "(admins only)" : c.claimers.join(", "),
  },
  {
    label: "Approvers",
    get: (c: { approvers?: string[] }) =>
      c.approvers === undefined ? "(anyone)" : c.approvers.length === 0 ? "(admins only)" : c.approvers.join(", "),
  },
];

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

export function registerProjectCommand(program: Command): void {
  const project = program.command("project").description("Quire projects.");

  project
    .command("list")
    .description("List projects you can see, optionally scoped to one organization.")
    .option("--org <id>", "Restrict to one organization (id = OID, slug, or URL).")
    .action(async (cmdOpts: { org?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projects = cmdOpts.org
        ? await client.listProjectsByOrg(await client.resolveOrgOid(cmdOpts.org))
        : await client.listProjects();
      renderList(projects, root, {
        columns: [
          { header: "ID", get: (p) => p.id },
          { header: "NAME", get: (p) => p.nameText ?? p.name },
          { header: "OID", get: (p) => p.oid },
        ],
        toId: (p) => p.oid,
      });
    });

  project
    .command("get <id>")
    .description("Show project details. <id> = OID, slug, or full URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(id);
      const p = await client.getProject(oid);
      renderObject(p, root, {
        fields: [
          { label: "Name", get: (p) => p.nameText ?? p.name },
          { label: "ID", get: (p) => p.id },
          { label: "OID", get: (p) => p.oid },
          { label: "Description", get: (p) => p.descriptionText },
          { label: "URL", get: (p) => p.url },
          { label: "Start", get: (p) => p.start },
          { label: "Due", get: (p) => p.due },
          { label: "Archived at", get: (p) => p.archivedAt },
          { label: "Public at", get: (p) => p.publicAt },
        ],
        toId: (p) => p.oid,
      });
    });

  project
    .command("members <id>")
    .description("List members of a project. <id> = OID, slug, or URL.")
    .action(async (id: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const oid = await client.resolveProjectOid(id);
      const members = await client.listProjectMembers(oid);
      renderList(members, root, {
        columns: [
          { header: "NAME", get: (m) => m.nameText ?? m.name },
          { header: "EMAIL", get: (m) => m.email ?? "" },
          { header: "OID", get: (m) => m.oid },
        ],
        toId: (m) => m.oid,
      });
    });

  // -------- Approval categories (Phase 5.3 slice B) --------

  const approvalCategory = project
    .command("approval-category")
    .description("Manage approval categories (gates that group approvers / claimers per project).");

  approvalCategory
    .command("add <project>")
    .description("Add an approval category to a project.")
    .requiredOption("--id <id>", "Caller-supplied id (must pass Quire's isValidId; '' is the implicit Default)")
    .requiredOption("--name <name>", "Category name")
    .option("--claimer <user>", "Claimer (OID, id, or email); repeat for multiple. Omit for 'anyone'.", append, [] as string[])
    .option("--approver <user>", "Approver; repeat for multiple. Omit for 'anyone'.", append, [] as string[])
    .option("--claimers-admins-only", "Restrict claimers to admins (overrides --claimer)")
    .option("--approvers-admins-only", "Restrict approvers to admins (overrides --approver)")
    .action(async (projectInput: string, cmdOpts: {
      id: string; name: string;
      claimer?: string[]; approver?: string[];
      claimersAdminsOnly?: boolean; approversAdminsOnly?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      const claimers = cmdOpts.claimersAdminsOnly === true
        ? []
        : (cmdOpts.claimer?.length ?? 0) > 0 ? cmdOpts.claimer : undefined;
      const approvers = cmdOpts.approversAdminsOnly === true
        ? []
        : (cmdOpts.approver?.length ?? 0) > 0 ? cmdOpts.approver : undefined;
      const c = await client.addProjectApprovalCategory(projectOid, {
        id: cmdOpts.id,
        name: cmdOpts.name,
        ...(claimers !== undefined ? { claimers } : {}),
        ...(approvers !== undefined ? { approvers } : {}),
      });
      renderObject(c, root, { fields: APPROVAL_CATEGORY_FIELDS, toId: (c) => c.id });
    });

  approvalCategory
    .command("update <project> <category-id>")
    .description("Update an approval category. --claimers-anyone / --approvers-anyone resets to 'anyone'.")
    .option("--name <name>", "New name")
    .option("--claimer <user>", "Replace claimer list; repeat for multiple", append, [] as string[])
    .option("--approver <user>", "Replace approver list; repeat for multiple", append, [] as string[])
    .option("--claimers-admins-only", "Restrict claimers to admins (empty list)")
    .option("--approvers-admins-only", "Restrict approvers to admins (empty list)")
    .option("--claimers-anyone", "Reset claimers to anyone (clears the list)")
    .option("--approvers-anyone", "Reset approvers to anyone (clears the list)")
    .action(async (projectInput: string, categoryId: string, cmdOpts: {
      name?: string;
      claimer?: string[]; approver?: string[];
      claimersAdminsOnly?: boolean; approversAdminsOnly?: boolean;
      claimersAnyone?: boolean; approversAnyone?: boolean;
    }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);

      let claimers: string[] | null | undefined;
      if (cmdOpts.claimersAnyone === true) claimers = null;
      else if (cmdOpts.claimersAdminsOnly === true) claimers = [];
      else if ((cmdOpts.claimer?.length ?? 0) > 0) claimers = cmdOpts.claimer;

      let approvers: string[] | null | undefined;
      if (cmdOpts.approversAnyone === true) approvers = null;
      else if (cmdOpts.approversAdminsOnly === true) approvers = [];
      else if ((cmdOpts.approver?.length ?? 0) > 0) approvers = cmdOpts.approver;

      const body: { name?: string; claimers?: string[] | null; approvers?: string[] | null } = {};
      if (cmdOpts.name !== undefined) body.name = cmdOpts.name;
      if (claimers !== undefined) body.claimers = claimers;
      if (approvers !== undefined) body.approvers = approvers;

      const c = await client.updateProjectApprovalCategory(projectOid, categoryId, body);
      renderObject(c, root, { fields: APPROVAL_CATEGORY_FIELDS, toId: (c) => c.id });
    });

  approvalCategory
    .command("remove <project> <category-id>")
    .description("Remove an approval category from a project. Prompts unless --yes.")
    .action(async (projectInput: string, categoryId: string) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const projectOid = await client.resolveProjectOid(projectInput);
      await confirmDestructive({
        question: `Remove approval category "${categoryId}" from project ${projectOid}? Tasks using this category will fall back to the default.`,
        yes: root.yes,
      });
      await client.removeProjectApprovalCategory(projectOid, categoryId);
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ project: projectOid, category: categoryId, removed: true })}\n`);
      } else if (root.quiet === true) {
        process.stdout.write(`${categoryId}\n`);
      } else {
        process.stderr.write(`Removed approval category "${categoryId}" from project ${projectOid}.\n`);
      }
    });
}
