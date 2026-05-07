import { Command } from "commander";
import { COLOR_TABLE, NAMED_COLORS } from "@quire-io/api-client";

import type { GlobalOpts } from "../options.js";
import { ansiSwatch, friendlyColor } from "../output/colors.js";
import { printTable } from "../output/table.js";

interface PaletteRow {
  code: string;
  hex: string;
  name: string;
}

export function registerColorsCommand(program: Command): void {
  program
    .command("colors")
    .description("List Quire's 48-slot icon-color palette (codes, hex, friendly names).")
    .action(() => {
      const root = program.opts<GlobalOpts>();

      const rows: PaletteRow[] = Object.entries(COLOR_TABLE)
        .map(([code, hex]) => ({
          code,
          hex,
          name: friendlyColor(code) ?? "",
        }))
        .sort((a, b) => a.code.localeCompare(b.code));

      if (root.json === true) {
        process.stdout.write(`${JSON.stringify({ palette: rows, namedColors: NAMED_COLORS })}\n`);
        return;
      }

      if (root.quiet === true) {
        for (const r of rows) process.stdout.write(`${r.code}\n`);
        return;
      }

      printTable(rows, [
        { header: "", get: (r) => ansiSwatch(r.code) },
        { header: "CODE", get: (r) => r.code },
        { header: "HEX", get: (r) => r.hex },
        { header: "NAME", get: (r) => r.name },
      ]);
    });
}
