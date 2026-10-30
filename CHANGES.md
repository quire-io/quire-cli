# Changelog

## Unreleased

Follows the Oct 30 2026 server release through `@quire-io/api-client` 1.2.6.

- **`--source-ref` on tasks** — `task create`, `task subtask` and `task update` take `--source-ref <json>`, the JSON object an app stores with a task and reads back as is. Its `text` is the Markdown Quire shows as the task's source line, and each app keeps its own data under a key named after it: `'{"text":"From [issue 42](https://…)","github":{"issue":42}}'`. `-` reads it from stdin and `@file` from a file. `task search --source-ref <key>` finds the tasks whose source ref has that key, whatever its value.
    - On `task update` it replaces the whole object, other apps' keys included; `--source-ref null` removes it.
    - Until Quire fixes it, a source ref in which a nested object or list comes before a key with a string value is rejected as too big, however small. Put `text` and the other string-valued keys first, as the example does.
    - `task get` gains Partner and Source ref lines.
- **`--partner` on tasks** — `task create`, `task subtask` and `task update` take `--partner <team>`, the name or OID of one of the project's external teams, to share the task and its subtasks with that team. Anything else is 400, and the API can't take a task off its team.
- **`sublist create --all`** puts every task of the project in the new sublist; take some out with `sublist remove-task`. It can't be changed later. `sublist get` gains an All tasks line.
- **`sublist add-task` / `remove-task --single`** adds or removes the task alone. Without it, the task's subtasks follow it, as before.
- **`comment update --as-app`** records the app instead of you as the one who edited or pinned the comment, like `comment add --as-app`.
- **`project export --status active|completed|all`** exports only the active or the completed tasks, and **`--merge`** (CSV only) puts the values of a repeated column, such as every tag, in one column.
- **`--recurrence-interval` is optional** on `task create` / `subtask` / `update` and `reminder create` / `update`: Quire takes it as 1.
- **Select options on `project field update`** — `--extra options='[…]'` replaces the whole set, each entry an object `{"name", "color"?, "from"?}`. `from` renames that option, and the tasks set to it keep their value. An option no entry names is removed, and its tasks lose the value. An entry without `color` keeps its color, and `options='[]'` removes every option. The `field add` help gives options as plain names (`'["Low","High"]'`), no longer as objects with a `label`.
- **What Quire changed on its side** (no CLI change):
    - Under `--json`: an approval category's `createdBy` is the `{oid, id, name}` user object, not the bare OID. A reminder's `task.id` is a number. A comment's `owner` is `{oid, id, type, …}`, and its `ownerType` is gone. An attachment's `url` is absolute everywhere, no longer `/att/...` in a task's, comment's or project's `attachments`.
    - `project update --start` / `--due` and `sublist create` / `update --start` / `--due` take a date only (`2026-11-02`); a time of day is 400. A sublist's dates come back as dates, no longer a timestamp at midnight UTC. `project update --start` / `--due` takes a project admin.
    - `status create` / `update` with a value already in use, and `project approval-category add` with an ID in use, are 409. `status update` used to succeed and change nothing, and `approval-category add` to return the existing category.
    - 402: `task undo-remove` beyond the plan's task limit, where Quire answered 200 and left the task removed; `task transfer` beyond the target's limits, where it was 400; `project update --public` on a plan without public projects; and `project export` below the Professional plan.
    - `reminder create --partner` must be one of the project's external teams, or on a task's reminder the team the task is shared with; anything else is 400. An unknown team used to be dropped, and the reminder sent to every member.
    - With read access only, `--add-follower` / `--remove-follower` may name only `me` or `app`, and `--follower` takes edit access, even as `--follower me`.
- Bumps `@quire-io/api-client` to `^1.2.6`.

## 1.1.4 — 2026-10-29

Follows the Oct 29 2026 server release through `@quire-io/api-client` 1.2.5.

- **You follow what you create again** — since the Oct 29 2026 server release, only the users in `followers`, plus anyone @mentioned in a task's or doc's description, follow a new task, doc or chat. Quire no longer adds you. `task create` (with or without `--parent` / `--sibling`), `task subtask`, `chat create` and `doc create` now add you to the `--follower` list unless `me` is already in it, as the Quire apps do for whoever creates a record. `task bulk-create` and `task bulk-subtasks` do the same for each item in `--from-file`, nested `tasks` included.
    - No flag skips it. To stop following, run `task update <id> --remove-follower me` afterwards, or the `chat update` / `doc update` equivalent.
- **`sublist create --start` / `--due`** set the new sublist's dates, as `sublist update` already could. `--include <task>`, repeatable, puts a task and all its subtasks in the new sublist.
- Bumps `@quire-io/api-client` to `^1.2.5`.

## 1.1.3 — 2026-10-27

Follows the Oct 19 and Oct 23 2026 server releases through `@quire-io/api-client` 1.2.4.

- **Fix: custom-field names with a `/`** — `project field update` / `rename` / `move` / `remove` and their `insight field` counterparts work on a field such as `Over/Under`, which Quire rejected with 400. They now send the field's name in the query instead of the path.
    - Until the Oct 23 2026 server release, these commands reported success and changed nothing on a name with a space or another character that needs encoding (`Billable Amount`). Quire fixed that on its side; the query form doesn't depend on it.
    - Quire's answers changed with it: a missing field, or a missing `--before` field, is 404 on `update`, `rename` and `move`, where it used to succeed; `field add` of a name already there, or a `rename` to one, is 409. `remove` of a missing field still succeeds.
- **`task approve --comment-as-app` takes effect** — since the Oct 19 2026 server release, Quire posts the companion comment as the app. The approval stays yours.
- **Attachment names keep their spaces** — since the Oct 23 2026 server release, `task attach` and `comment attach` save `My Report.md` as given, no longer as `My%20Report.md`. No CLI change.
- Bumps `@quire-io/api-client` to `^1.2.4`.

## 1.1.2 — 2026-10-19

Follows the rest of the Oct 16 2026 server release through `@quire-io/api-client` 1.2.3.

- **`task approve --comment-as-app`** replaces `--comment-as-user <user>`. It posts the companion comment as the app instead of as you, like `comment add --as-app`. The old flag promised to post as another user, which the API never offered: `asUser` is a yes/no for posting as the app, and Quire ignored the user given. No call worked with it, so taking it out breaks nothing that did.
    - Quire itself still posts an approval's comment as you, though the API doc says `asUser` posts it as the app. The flag takes effect once the server is fixed.
- **Approval help** — `task approve --comment` describes the header Quire writes: a plain `<category>: <status>` line, with no category for the default one. Without `--comment`, `approve`, `reject` and `change` log a header-only comment. `--category` on `task approve` and `task bulk-approve` takes the category's ID, not its name, and applies to every state, not only `request`.
- **Bulk batch size** — the `bulk-create` / `bulk-subtasks` help and the AI guide give the new cap: at most 300 items, and no more than the plan's per-minute limit (50 on the Free plan, 25 in a personal project on Free). Nested subtasks count as items. Quire rejects a larger batch with 402; split it.
- Bumps `@quire-io/api-client` to `^1.2.3`.

## 1.1.1 — 2026-10-16

Follows the Oct 16 2026 server release through `@quire-io/api-client` 1.2.2.

- **Fix: comment commands crashed** — `comment list` / `get` / `add` / `update`, `task comments`, `chat comments` and `chat comment add` failed with a `TypeError` unless run with `--json` or `--quiet`. The Oct 16 2026 server release returns a comment's `createdBy` as the `{oid, id, name}` user object the API doc gives, no longer the bare OID 1.1.0 was written against. The WHO column and the Who line read the author's name from it again, so the per-author user lookups 1.1.0 added are gone.
    - A comment posted as the app shows the app's name instead of `(app)`.
    - Under `--json`, `createdBy` of a comment, tag or partner is now that object, not an OID string; read `createdBy.oid` for the OID.
- Bumps `@quire-io/api-client` to `^1.2.2`.

## 1.1.0 — 2026-10-16

Covers the Sep 25 and Oct 15 2026 server releases through `@quire-io/api-client` 1.2.1. Additive under semver: the one flag removal, `dashboard --start` / `--due`, takes out flags Quire always rejected.

- **Comment reactions** (server release Oct 15 2026) — `comment add-emoji <oid> <emoji...>` adds your reactions to a task or chat comment and `comment remove-emoji <oid> <emoji...>` removes them. An emoji can be given as itself or by its shortcode (`+1`, `tada`, `:heart:`, any case), as separate arguments or comma-separated. Adding takes only the 20 emojis Quire's reaction picker offers, and one invalid emoji rejects the whole call with 400. Adding a reaction already there, or removing one that isn't, is a no-op. Both endpoints return no body, so the commands report what was sent (`{oid, added|removed}` under `--json`, the OID under `--quiet`) and `comment get` shows the result.
    - `comment get` gains a Reactions line (`👍 Alice, Bob · 🎉 Carol`), and `comment list`, `task comments` and `chat comments` gain a REACTIONS column of counts (`👍2 🎉1`).
- **Fix: the WHO column of a comment list was always empty**, and so was `comment get`'s Who line. A comment's `createdBy` is the author's user OID, not the user object the API doc gives (api-client 1.2.0), so `createdBy.name` never existed. The author names are now looked up once per distinct author, falling back to the OID when a user can't be read. A comment posted as the app shows as `(app)`. `--json` and `--quiet` skip the lookups.
- **`comment add --pin` / `--as-app`** pins the comment as it is created, or posts it as the app instead of as you. `chat comment add` gains `--as-app`.
- **`private` on works** (Oct 15 2026) — `sublist`, `doc`, `chat`, `insight` and `dashboard` `create` take `--private`, and their `update` takes `--private` / `--no-private`: a private record is hidden from guests and from the visitors of a public project or of a share link. Unlike `--member` it can be changed later. It is a choice only for a record visible to every member: one with members or a partner is always hidden from them, so `--private` is a no-op there and Quire rejects `--no-private` with 400. The matching `get` output gains a Private line.
- **Custom field access** (Oct 15 2026) — `project field add` / `update` and `insight field add` / `update` gain `--view-member <user>` / `--view-members-admins-only`, `--edit-member <user>` / `--edit-members-admins-only` and `--locked`. `update` also takes `--view-members-anyone` / `--edit-members-anyone` to lift a restriction, `--no-locked` and `--no-private`.
    - View members can see the values; an admin not named sees the field but not its values, and a field with view members is always private. Lifting the view restriction leaves the field private until `--no-private`, and `--no-private` together with a view restriction is rejected up front (Quire 400s on it).
    - Edit members apply to API writes too. `--locked` stops everyone, admins included, from editing the values in Quire, while the API can still write them.
    - The field output gains View members / Edit members / Locked lines. The `--private` help no longer says "visible only to admins": a private field is hidden from guests and visitors.
- **`reminder list --timing standalone|anchored` / `--status active|all`** (Sep 25 2026) — `standalone` lists the reminders firing at their own time (no task, or a task with no dates) and `anchored` those firing from their task's dates. `--status active` keeps only the reminders with a notification still to come.
- **Insights of any owner** — `insight list` and `insight create` take `--owner-type project|organization|folder|smart-folder` (default `project`), like `dashboard`. Projects and organizations resolve from OID / slug / URL; folders and smart folders need an OID. `insight create` also gains `--partner`; with `--member` it is rejected up front, as on `chat` and `dashboard`.
- **`task list` / `task subtasks --status active|completed|<0-100>`** — filtered before paging, so a page still holds `--limit` tasks while that many match.
- `task get` gains Predecessors and Successors lines (`#12, #15`).
- **Fix: `dashboard create` / `update` no longer take `--start` / `--due`**, and `dashboard get` no longer has Start / Due lines. A dashboard has no dates: Quire rejected either flag with 400 and never returned them, so no working call used them. Sublists, the only works with dates, keep theirs.
- Bumps `@quire-io/api-client` to `^1.2.1`.
- **Package metadata:** `homepage` points to the Quire CLI section of the API reference instead of the GitHub README, which stays linked as `repository`. The link carries `utm_source=npm&utm_medium=referral&utm_campaign=quire-cli` so GA4 can attribute the visits; on quire.io/dev/api/ the tag stays out of Quire's signup-source stats.

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
- **New [COVERAGE.md](COVERAGE.md)** — every runnable command and flag on one page (120 commands, 315 flags across 22 groups), generated by `scripts/gen-coverage.ts` from the commander tree rather than hand-maintained. To make that possible the command tree moved out of `src/cli.ts` into a new `src/program.ts` exporting `buildProgram()`; `cli.ts` is now just the entry point, and `quire --help` output is byte-identical. `npm run gen-coverage` refreshes the doc and `npm run check-coverage` fails on a diff — CI runs the latter as a drift guard, matching the api-client repo. The doc also surfaces 31 flags that currently have no help text.
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
