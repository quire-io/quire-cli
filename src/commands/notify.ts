import { Command } from "commander";

import { ValidationError } from "../errors.js";
import type { GlobalOpts } from "../options.js";
import { createQuireClient } from "../quire-client.js";
import { resolveTextInput } from "../util/text-input.js";

const append = (val: string, prev: string[] | undefined): string[] => [...(prev ?? []), val];

interface NotifyOpts {
  message: string;
  url?: string;
  recipient?: string[];
  all?: boolean;
}

export function registerNotifyCommand(program: Command): void {
  program
    .command("notify")
    .description("Send an in-app notification. Defaults to self; use --recipient or --all to fan out. Requires the `share` OAuth scope.")
    .requiredOption("--message <text>", "Notification text ('-' = stdin, '@file' = file)")
    .option("--url <url>", "Optional link the notification opens when clicked")
    .option("--recipient <user>", "User OID, ID, or email; repeat for multiple recipients. Omit to notify yourself.", append, [] as string[])
    .option("--all", "Broadcast to every user visible to the app (sends recipients: [\"*\"]). Cannot be combined with --recipient.")
    .action(async (cmdOpts: NotifyOpts) => {
      const root = program.opts<GlobalOpts>();
      const recipients = cmdOpts.recipient ?? [];
      if (cmdOpts.all === true && recipients.length > 0) {
        throw new ValidationError("Cannot combine --all and --recipient.");
      }
      const client = createQuireClient({ profile: root.profile });
      const message = await resolveTextInput(cmdOpts.message);
      await client.sendNotification({
        message,
        ...(cmdOpts.url !== undefined ? { url: cmdOpts.url } : {}),
        ...(cmdOpts.all === true ? { recipients: ["*"] } : recipients.length > 0 ? { recipients } : {}),
      });
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ sent: true })}\n`);
      } else if (root.quiet !== true) {
        process.stderr.write("Notification sent.\n");
      }
    });
}
