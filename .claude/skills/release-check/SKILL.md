---
name: release-check
description: Verify a quire-cli release landed across every distribution channel. Use after `npm publish`, after pushing a `v*` tag, or any time you want to confirm a release is live. Checks git tag, GitHub Release, release workflow run, npm registry version + `latest` dist-tag, homebrew-quire bump PR, and the live formula. Read-only by default — surfaces gaps but never auto-merges PRs or auto-publishes.
---

# release-check

Run this after `npm publish` (or any time you want to confirm a release is live across all distribution channels). The skill is read-only by default — it only takes action (merge a Homebrew bump PR, close a stale one) after explicit user go-ahead.

## Channels this project ships to

| Channel | Where users get it from | What lands it |
| --- | --- | --- |
| GitHub Release (SEA binaries) | <https://github.com/quire-io/quire-cli/releases> | `release.yml` workflow, triggered by `v*` tag push |
| npm | `npm i -g @quire-io/quire-cli` | Manual `npm publish` — **not** automated by the workflow |
| Homebrew tap | `brew install quire-io/quire/quire` | `release.yml` opens a bump PR against `quire-io/homebrew-quire`; **a human must merge it** |

Two manual steps in that table — `npm publish` and the Homebrew PR merge — are the most common places a release goes half-shipped. This skill catches both.

## Steps

Read `package.json` first:

```bash
V=$(node -p "require('./package.json').version")
echo "Checking quire-cli v$V"
```

Then run the eight checks below. Each one prints either a `✓` line (fine, move on) or a `✗` line plus a one-line "do this" pointer. Don't take action — just report.

### 1. Git tag on local + origin

```bash
git tag -l "v$V"                          # must print `v$V`
git ls-remote --tags origin "v$V"          # must return a line
```

✗ → tag missing: `git push origin v$V`.

### 2. GitHub Release published

```bash
gh release view "v$V" --json name,isDraft,assets --jq '{name, isDraft, assetCount: (.assets|length)}'
```

Expect `isDraft: false` and `assetCount: 6` (5 binaries + `SHA256SUMS`). If draft or zero assets, the release workflow probably failed — go to check 3.

### 3. Release workflow run

```bash
gh run list --workflow=release.yml --branch "v$V" --limit 1 --json status,conclusion,databaseId,createdAt
```

Expect `status: completed` and `conclusion: success`. If `in_progress`, **stop here and tell the user to re-run after it finishes** — the rest of the checks will be false negatives. If failed, surface the run ID and suggest `gh run view <id> --log-failed`.

### 4. npm version exists

```bash
npm view "@quire-io/quire-cli@$V" version
```

Expect the command to echo `$V` (a missing version errors with `E404`). ✗ → "run `npm publish`. The `prepublishOnly` script gates on typecheck + tests + build."

### 5. npm `latest` dist-tag advanced

```bash
npm view @quire-io/quire-cli dist-tags.latest
```

Expect `$V`. Catches the case where someone published with `npm publish --tag next` or another non-`latest` tag — `npm i -g @quire-io/quire-cli` would still pull the older version. ✗ → "run `npm dist-tag add @quire-io/quire-cli@$V latest`."

### 6. Homebrew bump PR

```bash
gh pr list --repo quire-io/homebrew-quire --state open --json number,title,headRefName,createdAt
```

Three states to handle:

- **PR for `bump-quire-$V` is open** → expected. Print URL + diff stat. **Ask the user** before merging. Suggested action: `gh pr merge <num> --repo quire-io/homebrew-quire --squash --delete-branch`.
- **PR for `bump-quire-$V` not present** → workflow didn't open it (or the tap-bump job failed). Check the release workflow logs.
- **Older `bump-quire-*` PRs are open** → stale. The formula tracks one version at a time, so merging an older bump just churns the file. **Ask the user** before closing them. Suggested action: `gh pr close <num> --comment "Superseded by #<latest>."`.

Never `gh pr merge` or `gh pr close` without explicit go-ahead in the same conversation.

### 7. Homebrew formula at `$V` (live)

```bash
gh api repos/quire-io/homebrew-quire/contents/Formula/quire.rb --jq .content \
  | base64 -d \
  | grep -E '^  version'
```

Expect `version "$V"`. If still older, the bump PR isn't merged yet — point at check 6.

### 8. Cross-check the formula's `url`s point at `v$V`

```bash
gh api repos/quire-io/homebrew-quire/contents/Formula/quire.rb --jq .content \
  | base64 -d \
  | grep -E 'releases/download/v[0-9]'
```

All four `url "...releases/download/v$V/..."` lines should match `v$V`. Catches the partial-bump case from #2 in the tap's history (`hotfix-v0.1.2-mac-arm`).

## Output format

After all checks, print a short summary table:

```
✓ Git tag v0.1.6 on local + origin
✓ GitHub Release v0.1.6 (6 assets)
✓ Release workflow run #26557943352 — success, 1m38s
✓ npm @quire-io/quire-cli@0.1.6 published
✓ npm dist-tags.latest = 0.1.6
✗ Homebrew: bump PR #6 still open — https://github.com/quire-io/homebrew-quire/pull/6
✗ Homebrew formula on tap still at 0.1.3
```

Then group the `✗` items into a short follow-up list and **ask the user** which (if any) to act on. Example:

> Two gaps:
> 1. Merge `quire-io/homebrew-quire#6` (closes 7 + 8 in one shot)
> 2. Close `quire-io/homebrew-quire#4` and `#5` if any older bump PRs are still open
>
> Want me to do either / both?

## Things this skill must never do without explicit go-ahead

- `gh pr merge` / `gh pr close`
- `git push` / `git tag` (creating or moving)
- `npm publish` / `npm dist-tag add`
- Edits to `package.json`, `CHANGES.md`, or workflow YAML

This skill verifies. Action belongs to the user.
