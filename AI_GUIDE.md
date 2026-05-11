# AI Guide

Recipes for pairing `quire-cli` with an LLM (Claude, ChatGPT, etc.) to
get useful work done on top of your Quire data — project reports, weekly
standups, task triage, bulk creation from notes, and more.

## Two ways to bring AI to your Quire data

1. **Pipe `quire ... --json` into an LLM CLI.** Stateless, scriptable,
   composes with `jq`, `xargs`, `grep`, and shell loops. This is what
   the recipes below use.
2. **Use the Quire MCP server with an MCP-aware AI client** (Claude
   Desktop, Claude Code, Claude.ai, etc.). Conversational; the AI
   calls Quire tools directly. See the
   [Quire API docs](https://quire.io/dev/api/) for details.

Every `quire` read command supports `--json`. Every bulk write accepts
`--from-file -` so a JSON array on stdin flows straight in. That makes
the CLI a clean pipe target and a clean pipe sink.

Examples below use `claude -p "<prompt>"` (Claude Code's non-interactive
mode) but any LLM CLI works — `llm`, `gpt`, `aichat`, `ollama run`,
whatever you have on `$PATH`.

---

## Recipe 1 — Weekly project digest

Turn a project export into a stakeholder-ready summary.

```bash
quire project export <project-id> --format json \
  | claude -p "Write a one-paragraph weekly digest for stakeholders.
Group tasks by status (in-progress, blocked, shipped this week).
Surface risks, name owners of blocked items, and skip routine
maintenance work."
```

`project export` includes the full task hierarchy with subtasks. For
very large projects, narrow the scope first with `quire task search`
or `quire task tree`.

---

## Recipe 2 — Personal weekly standup

```bash
quire mine --all-orgs --json \
  | claude -p "Summarize my week as three bullets:
1. Shipped (completed in the last 7 days)
2. In flight (status between 0 and 100, with recent activity)
3. At risk (due within 7 days, not yet completed)
Use task names, not IDs."
```

---

## Recipe 3 — Summarize a long comment thread

When a task has dozens of comments, ask the LLM for the gist.

```bash
TASK=<task-id>
{
  quire task get $TASK --json
  quire task comments $TASK --json
} | claude -p "This is one Quire task plus its comments.
Summarize: what is the task about, where does the discussion stand,
what decisions were made, what open questions remain, and what is
the next action and its owner?"
```

---

## Recipe 4 — Bulk-create tasks from meeting notes

Turn raw notes into actionable tasks. The LLM produces a JSON array
matching `quire task bulk-create`'s schema; the CLI ingests it.

```bash
cat meeting-notes.md \
  | claude -p 'Extract action items as a JSON array. Each item:
{"name": "...", "description": "...", "assignees": ["email"], "due": "YYYY-MM-DD"}.
Output only the JSON array, no prose.' \
  | quire task bulk-create <project-id> --from-file -
```

Add `--quiet` to capture the new task IDs for follow-up steps:

```bash
... | quire task bulk-create <project-id> --from-file - --quiet > new-ids.txt
```

---

## Recipe 5 — Break down an epic into subtasks

```bash
quire task get <epic-id> --json \
  | claude -p 'This is a high-level task. Generate a JSON array of
5-10 subtasks that would deliver it. Schema:
[{"name": "...", "description": "...", "priority": "low|medium|high"}]
Output only JSON.' \
  | quire task bulk-subtasks <epic-id> --from-file -
```

Review the LLM's output before running — `bulk-subtasks` is atomic per
call, but the tasks themselves are real. Use `quire undo task <oid>`
on anything you didn't mean to create.

---

## Recipe 6 — Triage stale or stuck tasks

```bash
quire mine --all-orgs --json \
  | claude -p "Identify tasks that look stale or stuck — no recent
update, missing assignee, due date passed, or a vague name. Return
a triage queue with a one-line reason for each."
```

To scope to one project:

```bash
quire task list <project-id> --json | claude -p "..."
```

---

## Recipe 7 — Roll up formula fields

`quire task formula` evaluates every formula custom field across a
project. Pair it with an LLM for natural-language rollups and anomaly
detection.

```bash
quire task formula <project-id> --json \
  | claude -p "Group these formula results by sublist and tag.
Highlight outliers — tasks whose computed values are far above or
below the group median. Give me the top five anomalies with a
one-line explanation each."
```

---

## Recipe 8 — Convert a pasted Quire URL into context

Useful inside larger scripts where the user pastes a URL and your
agent needs typed JSON to work with.

```bash
URL="https://quire.io/.../t/408"
quire resolve "$URL" --json | claude -p "Given this resolved Quire
object, suggest three useful follow-up actions."
```

`quire resolve` handles project, task, chat, doc, user, and org URLs
uniformly.

---

## Tips

- **Pick the smallest scope.** An entire org's tasks may overflow the
  LLM's context window. Prefer `--project` or a filtered
  `task search` over `--all-orgs` when you can.
- **`--quiet` is for piping IDs back into the CLI.** It emits one ID
  per line, ready for `xargs quire task complete`, etc.
- **Mind the rate limits.** Before long bulk runs, check
  `quire org limit <org-id>`. Bulk ops cap at 300 items per call.
- **Confirm before destructive ops.** Don't pass `--yes` blindly to
  AI-driven pipelines. `quire undo <kind> <oid>` can restore most
  resources if you act quickly.
- **`--json` is stable.** It's the raw API shape. Schema drift is
  rare; safe to depend on in scripts.

---

## See also

- [Quire API docs](https://quire.io/dev/api/) — including the Quire
  MCP server.
- [README](README.md) — installation and command overview.
