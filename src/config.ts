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

export function getApiServer(): string {
  return process.env.QUIRE_API_SERVER ?? "https://quire.io";
}
