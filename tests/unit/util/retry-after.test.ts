import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withRetryOn429 } from "../../../src/util/retry-after.js";

describe("withRetryOn429", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin Math.random so the ±10% jitter resolves to exactly the
    // indicated retry-after value: factor = 0.9 + 0.5*0.2 = 1.0.
    // Tests that exercise jitter explicitly override this.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the value on first try if no error", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetryOn429(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("rethrows non-429 errors immediately", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Quire API error 500: oops"));
    await expect(withRetryOn429(fn)).rejects.toMatchObject({ message: /500/ });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retries once after the indicated wait, then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Quire API error 429 (rate limited — retry after 5s)"))
      .mockResolvedValueOnce("recovered");
    const promise = withRetryOn429(fn);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("parses minute+second wait values (Xm Ys)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Quire API error 429 (rate limited — retry after 1m 5s)"))
      .mockResolvedValueOnce("ok");
    const promise = withRetryOn429(fn, { capSec: 120 });
    // Advance by 1m4s — should not have resolved yet
    await vi.advanceTimersByTimeAsync(64_000);
    expect(fn).toHaveBeenCalledTimes(1);
    // The remaining 1s tips it over
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws CliError exit 2 when wait exceeds the cap", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new Error("Quire API error 429 (rate limited — retry after 5m)"));
    await expect(withRetryOn429(fn, { capSec: 60 })).rejects.toMatchObject({
      name: "CliError",
      exitCode: 2,
      message: /retry in 300s/,
    });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("throws CliError exit 2 when retry-after is unparseable (no header)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Quire API error 429 (rate limited — wait at least 60s before retrying; precise wait time unavailable)",
        ),
      );
    await expect(withRetryOn429(fn)).rejects.toMatchObject({
      name: "CliError",
      exitCode: 2,
      message: /precise wait time unavailable/,
    });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("calls onRetry callback with the wait seconds before sleeping", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Quire API error 429 (rate limited — retry after 30s)"))
      .mockResolvedValueOnce("ok");
    const promise = withRetryOn429(fn, { onRetry });
    await vi.advanceTimersByTimeAsync(30_000);
    await promise;
    expect(onRetry).toHaveBeenCalledWith(30);
  });

  it("applies ±10% jitter to the retry sleep", async () => {
    // random=0.0 → factor 0.9 → sleep = 9000ms (10% under)
    vi.spyOn(Math, "random").mockReturnValue(0.0);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Quire API error 429 (rate limited — retry after 10s)"))
      .mockResolvedValueOnce("ok");
    const promise = withRetryOn429(fn);
    // 8999ms isn't enough — fn should still be on its first invocation.
    await vi.advanceTimersByTimeAsync(8_999);
    expect(fn).toHaveBeenCalledTimes(1);
    // Crossing 9000ms triggers the retry.
    await vi.advanceTimersByTimeAsync(2);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("upper-bound jitter: random=1.0 → sleep is 1.1× the indicated wait", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1.0);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Quire API error 429 (rate limited — retry after 10s)"))
      .mockResolvedValueOnce("ok");
    const promise = withRetryOn429(fn);
    // Advancing exactly the indicated wait isn't enough — sleep is 11000ms.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    // Cross the 11_000ms mark.
    await vi.advanceTimersByTimeAsync(1_001);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
