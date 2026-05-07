# Live API tests

Opt-in suite that hits the real Quire API. Excluded from `npm test` and only
runs via `npm run test:live`. Sequential execution; ~30 s per-test timeout.

## Auth

The suite resolves a `QuireClient` via `_setup.ts`:

1. `QUIRE_TEST_TOKEN` — raw access token. No refresh, so use a fresh one.
2. `QUIRE_TEST_PROFILE` (default `testdev`) — reuse a local CLI profile
   logged in via `quire login --profile <name>`. Refreshes automatically.

If neither path yields a usable client, every suite skips with a console
warning instead of failing.

## Write canary

`task-write.live.test.ts` creates a timestamped task and deletes it in the
same run. Gated on `QUIRE_TEST_PROJECT_OID` — set it to a project OID you
own. Without that env var the canary is skipped and the live run stays
read-only.

If the delete step ever fails (network blip, etc.) the task name is
timestamped so you can find and remove it manually.

## Running

```sh
# Read-only sweep using your local testdev profile
npm run test:live

# With an explicit token (CI)
QUIRE_TEST_TOKEN=... npm run test:live

# Including the create/delete canary
QUIRE_TEST_PROJECT_OID=<project-oid> npm run test:live
```

## Rate-limit notes

The current suite makes ~6 GETs and (optionally) 3 writes — well under the
60/minute limit. Keep new live tests tight: prefer reusing data from an
earlier `getMe` / `listOrganizations` call instead of re-fetching.

## CI

`.github/workflows/live.yml` runs this suite weekly (Mon 06:00 UTC) and on
manual dispatch. Configure on the repo:

- **Secret** `QUIRE_TEST_TOKEN` — a long-lived access token for a test
  account (rotate periodically).
- **Variable** `QUIRE_TEST_PROJECT_OID` (optional) — project OID for the
  write canary. If unset, only the read-only sweep runs.
