import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface LoopbackResult {
  code: string;
  state: string;
}

export interface LoopbackServer {
  /** The full redirect URL: `http://127.0.0.1:<port>/callback`. */
  redirectUri: string;
  /** Resolves on a successful `?code=…&state=…` redirect. */
  waitForCallback(opts?: { timeoutMs?: number }): Promise<LoopbackResult>;
  /** Stop listening. Idempotent. */
  close(): void;
}

const SUCCESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Quire CLI — login complete</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:32rem;margin:5rem auto;padding:0 1rem;color:#222;text-align:center}
h1{font-size:1.4rem}p{color:#555}</style></head>
<body><h1>You're signed in to Quire.</h1><p>You can close this window and return to your terminal.</p></body></html>
`;

// HTML-encode `reason` before interpolation. The OAuth callback's `error`
// and `error_description` query params are attacker-controllable (a
// crafted link can hand any string to this code path), so unescaped
// interpolation would be reflected XSS at the `http://127.0.0.1:<port>`
// origin. Limited blast radius — no cross-site cookies — but a script
// loaded here can probe other localhost services on the same machine.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function failureHtml(reason: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Quire CLI — login failed</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:32rem;margin:5rem auto;padding:0 1rem;color:#222;text-align:center}
h1{font-size:1.4rem;color:#b00020}p{color:#555}code{background:#f4f4f4;padding:.1rem .3rem;border-radius:3px}</style></head>
<body><h1>Login failed</h1><p><code>${escapeHtml(reason)}</code></p><p>You can close this window.</p></body></html>
`;
}

export interface StartLoopbackServerOptions {
  /**
   * TCP port to bind. Defaults to 0 (random free port) per RFC 8252 §7.3.
   * Pass a fixed port when the OAuth app's registered redirect URI requires
   * an exact-match port — `EADDRINUSE` will surface as a clean error if
   * another process holds it.
   */
  port?: number;
}

/**
 * Start a single-shot loopback server on `127.0.0.1`. The server listens
 * only on `127.0.0.1` — never `0.0.0.0` — so other machines on the network
 * can't observe the auth code in transit.
 */
export async function startLoopbackServer(
  opts: StartLoopbackServerOptions = {},
): Promise<LoopbackServer> {
  let resolveResult: (r: LoopbackResult) => void = () => {};
  let rejectResult: (e: Error) => void = () => {};
  const resultPromise = new Promise<LoopbackResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  // Set after server.listen() resolves; read by the handler on every request.
  // Used to validate the incoming `Host:` header — see the check below.
  let boundPort: number | undefined;

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    if (!req.url) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad request");
      return;
    }
    // Reject any request whose Host header isn't the loopback we bound to.
    // The legitimate browser redirect arrives as `Host: 127.0.0.1:<port>`;
    // a remote site abusing DNS rebinding (attacker.com → 127.0.0.1) sends
    // `Host: attacker.com:<port>`. Without this check, that remote request
    // is enough to resolve the single-shot callback promise, killing the
    // legitimate in-flight login.
    const host = req.headers.host;
    if (
      boundPort === undefined ||
      (host !== `127.0.0.1:${boundPort}` && host !== `localhost:${boundPort}`)
    ) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad host");
      return;
    }
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const error = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");
    if (error) {
      const message = errorDesc ? `${error}: ${errorDesc}` : error;
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(failureHtml(message));
      rejectResult(new Error(`OAuth error from Quire — ${message}`));
      return;
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(failureHtml("Missing code or state"));
      rejectResult(new Error("OAuth callback missing code or state"));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(SUCCESS_HTML);
    resolveResult({ code, state });
  };

  const server = createServer(handler);

  const port = opts.port ?? 0;
  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Close whatever is holding it, or set $QUIRE_CLI_LOOPBACK_PORT to a free port (must match the OAuth app's registered redirect URI).`,
          ),
        );
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  boundPort = address.port;
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    server.close();
  };

  return {
    redirectUri,
    waitForCallback: async ({ timeoutMs = 5 * 60 * 1000 } = {}) => {
      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Login timed out — no response after 5 minutes.")),
          timeoutMs,
        );
      });
      try {
        return await Promise.race([resultPromise, timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    close,
  };
}
