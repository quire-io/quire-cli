import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface ConfigPaths {
  configDir: string;
  credentialsPath: string;
  profile: string;
}

function resolveConfigHome(): string {
  if (process.env.QUIRE_CONFIG_HOME) return process.env.QUIRE_CONFIG_HOME;

  if (platform() === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "quire");
  }

  // XDG: $XDG_CONFIG_HOME/quire, falling back to ~/.config/quire.
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "quire");
  return join(homedir(), ".config", "quire");
}

export function resolveConfigPaths(profile?: string): ConfigPaths {
  const configDir = resolveConfigHome();
  const resolvedProfile = profile ?? process.env.QUIRE_PROFILE ?? "default";
  const credentialsFile =
    resolvedProfile === "default"
      ? "credentials.json"
      : `credentials.${resolvedProfile}.json`;
  return {
    configDir,
    credentialsPath: join(configDir, credentialsFile),
    profile: resolvedProfile,
  };
}

export function ensureConfigDir(configDir: string): void {
  // mode 0o700 is honored on POSIX; silently ignored on Windows.
  // recursive: true makes this idempotent.
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
}

export const DEFAULT_API_SERVER = "https://quire.io";

export function getApiServer(): string {
  return process.env.QUIRE_API_SERVER ?? DEFAULT_API_SERVER;
}

// Per-process one-shot guard so repeated callers (cli startup + login)
// don't print the warning multiple times in the same invocation.
let apiServerWarned = false;

/**
 * Print a stderr warning the first time it's called when `QUIRE_API_SERVER`
 * is set to something other than the default. A persistent override (set
 * in `.bashrc` or a parent shell) silently routes the OAuth flow through
 * an attacker-controlled origin; a one-line warning gives the user a
 * chance to spot it before clicking through the browser redirect.
 */
export function warnIfNonDefaultApiServer(): void {
  if (apiServerWarned) return;
  const override = process.env.QUIRE_API_SERVER;
  if (!override || override === DEFAULT_API_SERVER) return;
  apiServerWarned = true;
  const useColor = process.stderr.isTTY === true && !process.env.NO_COLOR;
  const prefix = useColor ? "\x1b[33mwarning:\x1b[0m" : "warning:";
  process.stderr.write(
    `${prefix} using non-default API server ${override} (set via QUIRE_API_SERVER)\n`,
  );
}
