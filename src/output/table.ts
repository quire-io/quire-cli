/**
 * Compact spaces-aligned table renderer. Matches the gh / kubectl aesthetic
 * (no border characters, lowercase header columns, two-space gutters) so
 * pipes through `grep` / `awk` keep working without unicode noise.
 */

const DEFAULT_MAX_CELL_WIDTH = 80;
const ELLIPSIS = "…";

export interface TableColumn<T> {
  header: string;
  get: (item: T) => string;
}

export interface PrintTableOptions {
  /** Skip per-cell truncation. */
  noTruncate?: boolean;
  /** Override the default 80-char per-cell ceiling. */
  maxCellWidth?: number;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}${ELLIPSIS}`;
}

export function printTable<T>(
  items: T[],
  columns: TableColumn<T>[],
  opts: PrintTableOptions = {},
): void {
  if (items.length === 0) return;

  const max = opts.maxCellWidth ?? DEFAULT_MAX_CELL_WIDTH;
  const cells = items.map((item) => columns.map((col) => col.get(item) ?? ""));
  const finalCells = opts.noTruncate
    ? cells
    : cells.map((row) => row.map((cell) => truncate(cell, max)));

  const widths = columns.map((col, i) =>
    Math.max(col.header.length, ...finalCells.map((row) => row[i]?.length ?? 0)),
  );

  const header = columns
    .map((col, i) => col.header.padEnd(widths[i] ?? 0))
    .join("  ")
    .trimEnd();
  process.stdout.write(`${header}\n`);

  for (const row of finalCells) {
    const line = row
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
    process.stdout.write(`${line}\n`);
  }
}
