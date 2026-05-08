import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// In a Node SEA / esbuild bundle, `process.env.QUIRE_CLI_VERSION` is
// substituted as a string literal at build time (see scripts/build-sea.mjs).
// In dev runs via `tsx` or `node dist/cli.js`, the env var is undefined, so
// we fall back to reading package.json next to the running file.
const BUILD_TIME_VERSION: string | undefined = process.env.QUIRE_CLI_VERSION;

export function readVersion(): string {
  if (BUILD_TIME_VERSION !== undefined && BUILD_TIME_VERSION !== "") {
    return BUILD_TIME_VERSION;
  }
  // package.json sits one level up from dist/cli.js (built) or src/cli.ts (dev via tsx).
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}
