/**
 * Aligned key/value renderer for `get` commands. Skips empty / nullish
 * values so a sparsely-populated object doesn't render a wall of "(none)".
 */

export interface KeyValueField<T> {
  label: string;
  get: (item: T) => string | undefined | null;
}

export function printKeyValue<T>(item: T, fields: KeyValueField<T>[]): void {
  const filled = fields.filter((f) => {
    const v = f.get(item);
    return v !== undefined && v !== null && v !== "";
  });
  if (filled.length === 0) return;

  const labelWidth = Math.max(...filled.map((f) => f.label.length));
  for (const field of filled) {
    const value = field.get(item) ?? "";
    process.stdout.write(`${field.label.padEnd(labelWidth)}  ${value}\n`);
  }
}
