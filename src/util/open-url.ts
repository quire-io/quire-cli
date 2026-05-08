import { spawn } from "node:child_process";

/**
 * Open `url` in the system default browser. Best-effort: detaches the child
 * and resolves once spawn succeeds. Errors during spawn (no `xdg-open`,
 * sandboxed environment, etc.) are surfaced via the returned Promise so the
 * caller can fall back to printing the URL.
 *
 * Why not the `open` npm package? It ships its own bundled `xdg-open` shell
 * script as a sibling file at runtime. That breaks Node SEA / pkg single-file
 * binaries — they can't carry an external sibling script. This helper relies
 * only on the platform tools that are already on the user's PATH.
 */
export function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];
    if (process.platform === "darwin") {
      cmd = "open";
      args = [url];
    } else if (process.platform === "win32") {
      // `start` is a cmd.exe builtin, not a separate executable. The empty
      // "" before url is the (otherwise positional) window title — without
      // it, `start "https://…"` would treat the URL as the title.
      cmd = "cmd";
      args = ["/c", "start", "", url];
    } else {
      cmd = "xdg-open";
      args = [url];
    }

    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", reject);
    // Detach so the parent process can exit independently of the browser.
    child.unref();
    resolve();
  });
}
