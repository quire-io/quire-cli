# Live API tests

Opt-in suite that hits the real Quire API. Excluded from `npm test` and only
runs via `npm run test:live`. Sequential execution; ~30 s per-test timeout.

## Auth

The suite resolves a `QuireClient` via `_setup.ts`. First match wins:

1. `QUIRE_TEST_REFRESH_TOKEN` — long-lived refresh token (180 days).
   Auto-refreshes on first call. Best for CI: stash once, rotate ~twice
   a year. Combine with `QUIRE_TEST_TOKEN` to skip the initial refresh
   when you have a fresh access token handy.
2. `QUIRE_TEST_TOKEN` — raw access token (1 hour TTL). No refresh. Best
   for one-off local debugging.
3. `QUIRE_TEST_PROFILE` (default `testdev`) — reuse a local CLI profile
   logged in via `quire login --profile <name>`. Refreshes automatically
   and persists rotated tokens to disk. Best for local dev.

If none yield a usable client, every suite skips with a console warning
instead of failing.

### `QUIRE_TEST_CLIENT_SECRET` — CI auth model

Quire's PKCE flow [does not issue refresh tokens][pkce]. The CI suite
therefore uses the OAuth app in **confidential mode** — passing the
app's `client_secret` to `/oauth/token` so a 180-day refresh token is
issued and the access token can be refreshed automatically across
weekly cron runs.

**This is a CI-only model, not the model for the distributed CLI.**
End users use PKCE (no `client_secret`) and currently re-authenticate
when the access token expires.

[pkce]: https://quire.io/dev/api/#pkce-support

### Reading the refresh token out of the OAuth app

Mint a refresh token via the confidential-client flow against the dev
OAuth app, then stash both the refresh token and the `client_secret` as
GH secrets per the names above.

If Quire rotates refresh tokens on each refresh, `onTokenRefresh` logs a
warning to CI output with the new token's prefix — update the
`QUIRE_TEST_REFRESH_TOKEN` secret when you see one.

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

- **Secret** `QUIRE_TEST_REFRESH_TOKEN` — refresh token for a test
  account. Lasts 180 days; the workflow auto-refreshes the access token
  on every run. Rotate before the 180-day mark or whenever you see the
  `refresh token rotated` warning in the logs.
- **Secret** `QUIRE_TEST_CLIENT_SECRET` — dev OAuth app's `client_secret`.
  CI uses the app in confidential mode to obtain a refresh token;
  PKCE-only flow does not issue one ([docs][pkce]).
- **Variable** `QUIRE_TEST_PROJECT_OID` (optional) — project OID for the
  write canary. If unset, only the read-only sweep runs.
