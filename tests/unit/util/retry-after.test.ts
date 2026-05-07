import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withRetryOn429 } from "../../../src/util/retry-after.js";

describe("withRetryOn429", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
});
