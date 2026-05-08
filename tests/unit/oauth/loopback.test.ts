import { request as httpRequest } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { startLoopbackServer, type LoopbackServer } from "../../../src/oauth/loopback.js";

/**
 * Send a raw HTTP/1.1 request with a custom `Host` header. `fetch` (undici)
 * treats Host as a forbidden header and silently overrides it, so we drop
 * down to `node:http` for tests that need to forge it.
 */
async function rawCallback(
  server: LoopbackServer,
  query: string,
  hostHeader: string,
): Promise<{ status: number; body: string }> {
  const target = new URL(`${server.redirectUri}${query}`);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers: { Host: hostHeader },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

let active: LoopbackServer | undefined;

afterEach(() => {
  active?.close();
  active = undefined;
});

async function fetchCallback(server: LoopbackServer, query: string): Promise<{ status: number; body: string }> {
  const url = `${server.redirectUri}${query}`;
  const res = await fetch(url);
  const body = await res.text();
  return { status: res.status, body };
}

describe("loopback callback failure page", () => {
  it("HTML-escapes error_description so reflected payloads can't break out of <code>", async () => {
    active = await startLoopbackServer();
    // The callback waits forever for code/state; trigger it asynchronously
    // and rely on the timeout from the rejected promise to clean up later.
    void active.waitForCallback({ timeoutMs: 1000 }).catch(() => {});

    const payload = "<img src=x onerror=alert(1)>";
    const { status, body } = await fetchCallback(
      active,
      `?error=oops&error_description=${encodeURIComponent(payload)}`,
    );
    expect(status).toBe(400);
    // The dangerous markers must NOT appear unescaped …
    expect(body).not.toContain("<img src=x onerror=alert(1)>");
    expect(body).not.toContain("<img");
    // … but the escaped form must be present.
    expect(body).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes & < > \" ' in the error param too", async () => {
    active = await startLoopbackServer();
    void active.waitForCallback({ timeoutMs: 1000 }).catch(() => {});

    const { body } = await fetchCallback(
      active,
      `?error=${encodeURIComponent("a&b<c>d\"e'f")}`,
    );
    // Each of the five HTML-significant chars escaped at least once.
    expect(body).toContain("a&amp;b&lt;c&gt;d&quot;e&#39;f");
  });

  it("returns the success page (no escaping concerns) for a valid code+state", async () => {
    active = await startLoopbackServer();
    const callbackPromise = active.waitForCallback({ timeoutMs: 5000 });

    const { status, body } = await fetchCallback(active, "?code=abc&state=xyz");
    expect(status).toBe(200);
    expect(body).toContain("You're signed in");

    const result = await callbackPromise;
    expect(result).toEqual({ code: "abc", state: "xyz" });
  });

  it("rejects requests whose Host header isn't loopback (DNS-rebinding guard)", async () => {
    active = await startLoopbackServer();
    // Don't await — the callback must NOT resolve from a forged-Host request.
    const callbackPromise = active.waitForCallback({ timeoutMs: 1000 }).catch((err: Error) => err);

    const { status, body } = await rawCallback(active, "?code=abc&state=xyz", "attacker.example.com");
    expect(status).toBe(400);
    expect(body).toBe("Bad host");

    // The single-shot promise must still be pending — i.e. it eventually
    // times out, not resolves with the attacker payload.
    const settled = await callbackPromise;
    expect(settled).toBeInstanceOf(Error);
    expect((settled as Error).message).toContain("timed out");
  });

  it("accepts the localhost alias for Host (some browsers send it)", async () => {
    active = await startLoopbackServer();
    const callbackPromise = active.waitForCallback({ timeoutMs: 5000 });

    const port = new URL(active.redirectUri).port;
    const { status } = await rawCallback(active, "?code=abc&state=xyz", `localhost:${port}`);
    expect(status).toBe(200);

    const result = await callbackPromise;
    expect(result).toEqual({ code: "abc", state: "xyz" });
  });
});
