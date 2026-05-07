import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import { ensureConfigDir, resolveConfigPaths } from "./config.js";

export interface StoredCredentials {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires (per `@quire-io/api-client`). */
  expiresAt: number;
  /** OID of the signed-in Quire user — captured at login time. */
  userOid: string;
}

export function readCredentials(profile?: string): StoredCredentials | null {
  const { credentialsPath } = resolveConfigPaths(profile);
  if (!existsSync(credentialsPath)) return null;
  const raw = readFileSync(credentialsPath, "utf8");
  return JSON.parse(raw) as StoredCredentials;
}

/**
 * Atomically persist credentials. Writes to a same-directory temp file
 * first, then renames over the target so a CLI killed mid-rotation can't
 * leave a torn JSON file behind. File mode is 0600 on POSIX (silently
 * ignored on Windows).
 */
export function writeCredentials(creds: StoredCredentials, profile?: string): void {
  const { configDir, credentialsPath } = resolveConfigPaths(profile);
  ensureConfigDir(configDir);
  const tmpPath = `${credentialsPath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(creds, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmpPath, credentialsPath);
}

export function deleteCredentials(profile?: string): void {
  const { credentialsPath } = resolveConfigPaths(profile);
  if (existsSync(credentialsPath)) unlinkSync(credentialsPath);
}
