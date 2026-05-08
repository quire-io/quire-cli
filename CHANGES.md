# Changelog

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
