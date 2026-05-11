# Quire CLI

A command-line interface to the [Quire API](https://quire.io/dev/api/) for terminal users and shell scripts.

## What it is

`@quire-io/quire-cli` wraps the Quire REST API for direct human + shell use:

- **Single-user, runs locally.** No server, no database. The signed-in user is whoever ran `quire login` on this machine.
- **OAuth login** via loopback redirect + PKCE. Tokens stored in `~/.config/quire/credentials.json` (mode `0600`) or the OS keychain when available.
- **Composable output.** Human-readable tables by default; `--json` for `jq`; `--quiet` for ID-only output that pipes into `xargs`.
- **Full Quire API coverage** — tasks (incl. recurrence, approval, timelogs, bulk ops), projects, organizations, comments, chats, documents, insights, custom fields, undo-remove.

## What it isn't

- Not a hosted / SaaS tool — runs on your laptop.
- Not an interactive TUI dashboard — v1 is headless subcommands only.

## Install

```bash
# npm (most users)
npm i -g @quire-io/quire-cli

# Homebrew (macOS / Linux)
brew install quire-io/quire/quire

# Try without installing
npx @quire-io/quire-cli --help

# Or grab a single-file binary from GitHub Releases
# https://github.com/quire-io/quire-cli/releases
```

## Usage

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

Run `quire --help` (or `quire <command> --help`) for the full command reference.

## Using with AI

See [AI_GUIDE.md](AI_GUIDE.md) for recipes pairing the CLI with an LLM (Claude, ChatGPT, etc.) — project digests, weekly standups, bulk task creation from meeting notes, and more.

## Updating

How you update depends on how you installed:

| Installed via | Upgrade command |
| --- | --- |
| `npm i -g` | `npm i -g @quire-io/quire-cli@latest` |
| Homebrew | `brew upgrade quire` |
| `npx` | nothing — `npx @quire-io/quire-cli` always pulls the latest unless you pinned a version |
| GitHub Releases binary | re-download from <https://github.com/quire-io/quire-cli/releases> and replace the binary on `$PATH` |

Check your installed version with `quire --version` and compare against the [Releases page](https://github.com/quire-io/quire-cli/releases).

## Signing out

`quire logout` removes the local credentials file. It does **not** revoke
the OAuth refresh token on the Quire server — the public-PKCE flow gives
the CLI no way to authenticate a revoke call.

If you're signing out because the device is lost or compromised, also visit
<https://quire.io/apps> and remove the Quire CLI app to invalidate the
refresh token server-side.

## Related

- [Quire](https://quire.io) — the product this CLI talks to.
- [Quire API docs](https://quire.io/dev/api/)

## Contributing

Open an issue to discuss before sending a PR.

## License

[ISC](LICENSE) © Potix Corporation
