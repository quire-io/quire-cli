# Changelog

## 0.1.3 — 2026-05-11

- `quire mine` switched to the new `QuireClient.getMyTasks(scope, filter)` helper from `@quire-io/api-client` 0.1.7. Behaviour changes:
  - `--all-orgs` now deduplicates tasks by OID. Previously a task that surfaced in two organizations (e.g. a guest in a shared project) appeared twice.
  - `--all-orgs` now includes the user's private Inbox by default. Pass `--skip-inbox` to restore the old "orgs only" fan-out.
  - New `--inbox` flag scopes to the private Inbox alone. Mutually exclusive with `--project` / `--org` / `--all-orgs`.
- Bumps `@quire-io/api-client` to `^0.1.7` (0.1.6 type re-exports were broken and never reached npm).

## 0.1.2 — 2026-05-09

- `quire task formula <project>` — evaluate all formula-type custom fields for every task in a project. Prints a table of task ID, name, and one column per formula field; use `--json` for structured output. Requires `@quire-io/api-client` 0.1.5 and uses the tiered loader (export JSON on paid plans, flat list fallback).

## 0.1.1 — 2026-05-08

Switch OAuth to the production Quire CLI app, plus a round of input-handling and OAuth-flow hardening.

### Auth

- **OAuth `client_id` switched** from the development Quire CLI app to the production app. Existing 0.1.0 users will need to re-run `quire login` after upgrading; refresh tokens issued by the dev app no longer work.
- OAuth loopback callback validates the `Host` header before completing the redirect.
- HTML-escaped messages on the OAuth loopback failure page.
- `quire logout --help` documents the no-server-revoke caveat: local credentials are deleted, but the refresh token remains valid server-side until the user removes the app from <https://quire.io/apps>.

### Input handling

- `quire task attach`, `quire comment attach`, `--from-file`, and `--text @file` now cap input size and tighten filename validation (no path separators, length-limited).

### Reliability

- 429 retry sleep gains ±10% jitter to spread out retry storms when many CLI processes hit the limit at once.
- Stderr warning when `QUIRE_API_SERVER` is set — surfaces non-default targets on every command.

### Build

- SEA-binary build verifies the auto-downloaded Node archive against a pinned SHA-256.
- macOS notarization stores credentials in a temporary keychain instead of passing them on `argv`.

## 0.1.0 — 2026-05-08

Initial release.

### Commands

- `quire login` / `quire logout` / `quire whoami` — OAuth PKCE login, credential management, and identity.
- `quire org list` / `quire org get` / `quire org limit` — organization listing, detail, and rate-limit inspection.
- `quire project list` / `quire project get` / `quire project members` — project browsing and membership.
- `quire project field` — custom-field management (add / update / rename / move / remove).
- `quire project approval-category` — approval-category management.
- `quire task list` / `quire task get` / `quire task tree` / `quire task search` / `quire task subtasks` / `quire task comments` — task reads.
- `quire task create` / `quire task subtask` / `quire task update` / `quire task complete` / `quire task uncomplete` / `quire task move` / `quire task transfer` / `quire task delete` — task writes.
- `quire task dates` / `quire task peekaboo` — date and visibility management.
- `quire task approve` / `quire task revoke-approval` — approval flow.
- `quire task timelog add` / `quire task timelog update` / `quire task timelog remove` — time logging.
- `quire task bulk-create` / `quire task bulk-update` / `quire task bulk-delete` / `quire task bulk-move` / `quire task bulk-transfer` / `quire task bulk-approve` — bulk operations (up to 300 tasks).
- `quire mine` — tasks assigned to the signed-in user.
- `quire tag` / `quire sublist` / `quire status` — project metadata (create / update / delete).
- `quire comment` / `quire chat` / `quire doc` / `quire insight` — comments, chats, documents, and insights.
- `quire undo` — restore recently deleted resources.
- `quire resolve` — resolve any Quire URL to the typed resource.
- `quire colors` — list Quire's 48-slot color palette.

### Output

- Human-readable tables with per-cell truncation (disable with `--no-truncate`).
- `--json` for raw API JSON; `-q` / `--quiet` for ID-only lines (xargs-friendly).
- `--color-mode always|never|auto`; `--profile` for named credential profiles.
- Auto-retry on HTTP 429 with `Retry-After` back-off.
- `User-Agent: quire-cli/<version>` on every request.
