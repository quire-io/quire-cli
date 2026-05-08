import { afterEach, describe, expect, it } from "vitest";

import { startLoopbackServer, type LoopbackServer } from "../../../src/oauth/loopback.js";

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
});
