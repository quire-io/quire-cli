import { Command } from "commander";

import type { GlobalOpts } from "../options.js";
import { createQuireClient } from "../quire-client.js";
import { resolveTextInput } from "../util/text-input.js";

export function registerNotifyCommand(program: Command): void {
  program
    .command("notify")
    .description("Send an in-app notification to yourself. Requires the `share` OAuth scope.")
    .requiredOption("--message <text>", "Notification text ('-' = stdin, '@file' = file)")
    .option("--url <url>", "Optional link the notification opens when clicked")
    .action(async (cmdOpts: { message: string; url?: string }) => {
      const root = program.opts<GlobalOpts>();
      const client = createQuireClient({ profile: root.profile });
      const message = await resolveTextInput(cmdOpts.message);
      await client.sendNotification({
        message,
        ...(cmdOpts.url !== undefined ? { url: cmdOpts.url } : {}),
      });
      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ sent: true })}\n`);
      } else if (root.quiet !== true) {
        process.stderr.write("Notification sent.\n");
      }
    });
}
