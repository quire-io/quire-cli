import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests run against pure helpers and mocked fetch — fast, deterministic, no network.
    // Live API tests live in tests/quire_api/ and are opt-in via npm run test:live.
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
    clearMocks: true,
  },
});
