/**
 * Global flags resolved by commander on the root program. Subcommand
 * actions read these via `program.opts<GlobalOpts>()`.
 *
 * Note: commander folds `--no-truncate` into a boolean field named
 * `truncate` (default `true`; passing the flag sets it to `false`). All
 * other negation-style flags follow the same rule.
 */
export interface GlobalOpts {
  verbose?: boolean;
  json?: boolean;
  quiet?: boolean;
  color?: "always" | "never" | "auto";
  profile?: string;
  yes?: boolean;
  /** `false` when the user passed `--no-truncate`. Default `true`. */
  truncate?: boolean;
}
