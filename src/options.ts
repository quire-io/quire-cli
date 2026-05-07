/**
 * Global flags resolved by commander on the root program. Subcommand
 * actions read these via `program.opts<GlobalOpts>()`.
 *
 * Note: commander folds `--no-truncate` into a boolean field named
 * `truncate` (default `true`; passing the flag sets it to `false`). All
 * other negation-style flags follow the same rule.
 *
 * Output-color control is `--color-mode` rather than `--color` because
 * subcommands like `quire tag create` / `quire status create` already
 * use `--color <name-or-code>` for the palette color of the resource;
 * commander resolves duplicate option names per-subcommand, so a root
 * `--color` would shadow the subcommand's required `--color` flag.
 */
export interface GlobalOpts {
  verbose?: boolean;
  json?: boolean;
  quiet?: boolean;
  colorMode?: "always" | "never" | "auto";
  profile?: string;
  yes?: boolean;
  /** `false` when the user passed `--no-truncate`. Default `true`. */
  truncate?: boolean;
}
