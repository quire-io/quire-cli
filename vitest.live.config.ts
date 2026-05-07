import { defineConfig } from "vitest/config";

/**
 * Live API tests: opt-in suite that hits real quire.io endpoints. Run via
 * `npm run test:live`. Sequential file execution + a 30 s per-test timeout
 * keep the suite under the per-minute rate limit and surface hung calls.
 *
 * Auth precedence (resolved in tests/quire_api/_setup.ts):
 *   1. QUIRE_TEST_TOKEN  — raw access token (no refresh)
 *   2. QUIRE_TEST_PROFILE — local CLI profile name (default: "testdev")
 * If neither yields a working client the suite skips with a console warning
 * instead of failing.
 */
export default defineConfig({
  test: {
    include: ["tests/quire_api/**/*.live.test.ts"],
    environment: "node",
    globals: false,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
