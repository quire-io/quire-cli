/**
 * Routes a command's data into the right output sink based on the user's
 * global flags. Three modes — see PLAN.md Phase 0 / Phase 6:
 *   - `--json` — raw JSON to stdout (round-trips back to the API)
 *   - `--quiet` — id-only, one per line, designed for `xargs`
 *   - default — human-readable table (lists) or key/value (single objects)
 *
 * Lists with zero items emit nothing in human mode (no "no rows" banner) so
 * `quire ... list | wc -l` returns 0 cleanly.
 */
import type { GlobalOpts } from "../options.js";
import { printKeyValue, type KeyValueField } from "./keyvalue.js";
import { printTable, type TableColumn } from "./table.js";

export interface RenderListConfig<T> {
  columns: TableColumn<T>[];
  /** Required for `--quiet`; called to emit the id-only line per item. */
  toId?: (item: T) => string;
}

export interface RenderObjectConfig<T> {
  fields: KeyValueField<T>[];
  /** Required for `--quiet`; called to emit the id-only line. */
  toId?: (item: T) => string;
}

export function renderList<T>(
  items: T[],
  opts: GlobalOpts,
  config: RenderListConfig<T>,
): void {
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify(items)}\n`);
    return;
  }
  if (opts.quiet === true) {
    if (!config.toId) return;
    for (const item of items) process.stdout.write(`${config.toId(item)}\n`);
    return;
  }
  printTable(items, config.columns, { noTruncate: opts.truncate === false });
}

export function renderObject<T>(
  item: T,
  opts: GlobalOpts,
  config: RenderObjectConfig<T>,
): void {
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify(item)}\n`);
    return;
  }
  if (opts.quiet === true) {
    if (!config.toId) return;
    process.stdout.write(`${config.toId(item)}\n`);
    return;
  }
  printKeyValue(item, config.fields);
}
