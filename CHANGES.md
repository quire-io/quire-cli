# Changelog

## 1.0.0 — 2026-09-22

First stable release, cut alongside `@quire-io/api-client` 1.0.0. The command surface has been additive since 0.1.0 — no flag or output shape has been removed — so it is now committed to under semver: a breaking change to a command, flag or `--json` shape needs a major bump.

- **Task follower management** (server release Sep 21 2026, api-client 1.0.0) — `task create` / `task subtask` gain repeatable `--follower <user>`; `task update` gains full-replace `--follower` (rejected when combined with the deltas) plus `--add-follower` / `--remove-follower`. Values are a user OID, ID or email, plus `me`, `app` (with the `app|team` / `app|team|channel` / `app|/path` hook-path forms), and the task-only `inherit` — on add it pulls in the parent task's followers, on remove it drops the ones inherited from the parent. `task get` now renders a Followers line, and `task search` gains a `--follower` filter to match the existing `--assignee` one.
- **`quire reminder` command group** wrapping the new Reminder API: `list <owner>` / `get <oid>` / `create <owner>` / `update <oid>` / `delete <oid>`. `--owner-type project|organization|folder|smart-folder|task` (default `project`) — unlike the other owner-scoped groups these endpoints have no implied owner, and `task` is a type of its own. Projects, organizations and tasks resolve from OID / slug / URL; folders and smart-folders must be OIDs. Pass `-` as the owner for your own Inbox.
    - `--lead` takes `<n>m` (minutes, an absolute offset), `<n>d` (calendar days, keeping wall-clock time across a DST change) or `<n>d@HH:mm`, and repeats up to Quire's 30-lead ceiling. A bare number is minutes. There is deliberately no `h` or `w` unit — the wire format has only the two, so an hour is `60m` and a week `7d`. Omit the flag for one notification at the fire time.
    - `--when` is required when the reminder has no task, or its task has neither a start nor a due date. A dated task supplies the fire time itself, and Quire rejects `--when` / `--recurrence-*` with 400 in that case.
    - `update` changes only `--when` / `--lead` / `--name` / recurrence; `'null'` clears `--when` and `--name`, and `--clear-recurrence` stops it repeating. Members and partner are create-only.
    - `delete` is permanent — reminders don't go to the trash, so the prompt does not offer an undo and there is no `undo-remove` subcommand.
    - `list` writes a one-line stderr note that the order is by OID, not fire time.
- **`--member` on create** — `sublist create`, `doc create`, `chat create`, `insight create`, `dashboard create` and `reminder create` accept repeatable `--member <user>` (OID, ID, email, or `me`) plus `--members-admins-only`, so a record can be created visible only to chosen users. Tri-state: omit both for every member of the owner, `--members-admins-only` for the owner's admins, a `--member` list for just those users. Create-only — Quire has no endpoint to change it afterwards, so unlike `project approval-category add` the two flags are rejected together rather than one silently winning. `--member` with `--partner` is rejected up front (Quire 400s on the pair). The matching `get` output gains a Members line that tells `(everyone)` from `(admins only)`.
- `project update` / `org update` gain full-replace `--follower` alongside the `--add-follower` / `--remove-follower` deltas they already had.
- Bumps `@quire-io/api-client` to `^1.0.0`. Its one breaking change — `members` returned as user objects rather than OID strings — doesn't reach this CLI: `project members` uses `listProjectMembers`, which was always `QuireUser[]`. The release's error-taxonomy split moves plan limits from `429` to `402`, which quietly improves the CLI's retry behaviour: a quota error no longer burns the one automatic retry in `withRetryOn429`, since that path keys off the `429` message prefix.

## 0.1.7 — 2026-08-21

- New `quire dashboard` command group wrapping the Dashboard API (server release Jul 20 2026): `list <owner>` / `get <id>` / `create <owner>` / `update <oid>` / `delete <oid>` / `undo-remove <oid>`. `--owner-type project|organization|folder|smart-folder` (default `project`); projects and organizations resolve from OID / slug / URL, folders and smart-folders must be passed as OIDs (no resolution endpoint). `get` also accepts `"owner-id/<dashboard-id>"`. `update` clears dates via `--start null` / `--due null` (same convention as `task dates`) and archives via `--archive` / `--unarchive`. The API manages the dashboard container only — widget definitions aren't part of the public API yet.
- `quire undo dashboard <oid>` joins the generic undo command.
- Chat & doc follower management (server release Jun 4 2026): `chat create` / `doc create` gain repeatable `--follower <user>` (OID, ID, or email); `chat update` / `doc update` gain full-replace `--follower` (rejected when combined with `--add-follower` / `--remove-follower`), and `doc update` also gains `--add-follower` / `--remove-follower`. `chat get` / `doc get` now render a Followers line. Documents are followable only when project-owned — the server returns 400 otherwise.
- Bumps `@quire-io/api-client` to `^0.1.12`. No CLI change needed for the Jul 31 2026 Comment API URL-form removals — the client already uses only the surviving forms.

## 0.1.6 — 2026-05-28

- `quire task approve <id>` accepts an optional companion comment: `--comment <text|-|@file>` posts a comment on the task as a side effect of the approval, server-prefixed with `**<stream>: <status>**`. `--comment-pinned` pins it and `--comment-as-user <user>` posts as another OID/id/email; both require `--comment`. `bulk-approve` is not extended — the server intentionally exposed this on the single-task endpoint only.
- `quire insight run <oid>` — runs a project-scoped insight server-side and prints the aggregated result. Default render is a padded table (row 0 of the API response becomes the header row); `--json` emits the raw 2D array; `--quiet` emits data rows tab-separated, no headers. `--group-by member|section` and `--status active|completed|all` are forwarded as query params; both default server-side when omitted.
- Bumps `@quire-io/api-client` to `^0.1.11`. Transitive: numeric custom-field filters on `searchTasks` (`ge:` / `gt:` / `le:` / `lt:` / `between:v1,v2` / `isNull` / …) — the CLI doesn't yet surface `--custom-field` as a filter on `task search`, so this is dormant until that flag lands.

## 0.1.5 — 2026-05-22

- All seven `quire task bulk-*` subcommands accept `--dry-run` (`bulk-create`, `bulk-subtasks`, `bulk-update`, `bulk-delete`, `bulk-move`, `bulk-transfer`, `bulk-approve`). The server runs the full operation — auth, permission checks, FK existence, business rules — inside a transaction and rolls back before responding, so the result table mirrors what a real call would return without persisting anything. `bulk-delete --dry-run` also skips the interactive confirmation prompt since no delete is performed. A `Dry run — no changes were persisted.` notice is written to stderr (stdout stays clean for `--quiet` OID piping and `--json` streams).
- Bumps `@quire-io/api-client` to `^0.1.9`. Transitively switches `getRateLimit` to the renamed `/rate-limit` server path; no CLI surface change.

## 0.1.4 — 2026-05-15

- `quire notify` gains `--recipient <user>` (repeatable; OID, ID, or email) and `--all` (sends `recipients: ["*"]` — broadcast to every user visible to the app). Combining `--all` with `--recipient` is rejected up front. Omitting both keeps the previous self-notify behavior. Recipients must be colleagues visible via `GET /user/list`; the server rate-limits at 1 unit per 10 delivered recipients (rounded up, minimum 1), and unknown / invisible recipients return 404 with an identical response for every case.
- `quire task peekaboo` gains `--show` to un-hide a task (sends `peekaboo: false`), and now rejects `--reshow-at` timestamps that are already in the past — the server would otherwise archive the task with a stale auto-unarchive time.
- Bumps `@quire-io/api-client` to `^0.1.8`.

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
