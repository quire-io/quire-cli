# Quire CLI

A command-line interface to the [Quire API](https://quire.io/dev/api/) for terminal users and shell scripts.

> **Status: pre-release.** Active development; the first published version will be tagged here as `v0.1.0`.

## What it is

`@quire-io/quire-cli` wraps the Quire REST API for direct human + shell use:

- **Single-user, runs locally.** No server, no database. The signed-in user is whoever ran `quire login` on this machine.
- **OAuth login** via loopback redirect + PKCE. Tokens stored in `~/.config/quire/credentials.json` (mode `0600`) or the OS keychain when available.
- **Composable output.** Human-readable tables by default; `--json` for `jq`; `--quiet` for ID-only output that pipes into `xargs`.
- **Full Quire API coverage** — tasks (incl. recurrence, approval, timelogs, bulk ops), projects, organizations, comments, chats, documents, insights, custom fields, undo-remove.

## What it isn't

- Not a hosted / SaaS tool — runs on your laptop.
- Not an interactive TUI dashboard — v1 is headless subcommands only.

## Install (planned)

Once the first version ships:

```bash
# npm (most users)
npm i -g @quire-io/quire-cli

# Homebrew tap (macOS / Linux)
brew install quire-io/quire/quire

# Try without installing
npx @quire-io/quire-cli --help

# Or grab a single-file binary from GitHub Releases
# https://github.com/quire-io/quire-cli/releases
```

## Usage (planned)

```bash
quire login                                # one-time OAuth setup
quire whoami                               # confirm you're signed in

quire project list
quire task list <project>
quire task tree <task-id> --depth full     # recursive subtree view
quire task search "release notes" --mine

quire task create <project> --name "Ship CLI v1" --due 2026-06-30
quire task complete <task-id>

quire mine --all-orgs --json | jq '.[].name'   # script-friendly
```

Full command reference will be added once the first commands land.

## Related

- [Quire](https://quire.io) — the product this CLI talks to.
- [Quire API docs](https://quire.io/dev/api/)

## Contributing

Open an issue to discuss before sending a PR.

## License

[ISC](LICENSE) © Potix Corporation
