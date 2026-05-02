import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoDuplicateLocalEvent,
  computeRetryDelayMs,
  resolveActionFromLatestLocalEvent,
  sortOutboxForSync,
} from "./offlineClockState";

test("pending IN changes local state to clocked in", () => {
  assert.equal(resolveActionFromLatestLocalEvent("IN", "clock-in"), "clock-out");
});

test("pending OUT changes local state to clocked out", () => {
  assert.equal(resolveActionFromLatestLocalEvent("OUT", "clock-out"), "clock-in");
});

test("duplicate local IN and OUT events are blocked", () => {
  assert.throws(() => assertNoDuplicateLocalEvent("IN", "IN"), /duplicate_clock_in/);
  assert.throws(() => assertNoDuplicateLocalEvent("OUT", "OUT"), /duplicate_clock_out/);
  assert.doesNotThrow(() => assertNoDuplicateLocalEvent("IN", "OUT"));
});

test("failed sync retries with capped exponential backoff", () => {
  assert.equal(computeRetryDelayMs(0), 1000);
  assert.equal(computeRetryDelayMs(3), 8000);
  assert.equal(computeRetryDelayMs(99), 60 * 60 * 1000);
});

test("outbox events sync in local creation order", () => {
  const ordered = sortOutboxForSync([
    { id: 3, createdAt: "2026-04-26T17:00:00.000Z" },
    { id: 1, createdAt: "2026-04-26T09:00:00.000Z" },
    { id: 2, createdAt: "2026-04-26T09:00:00.000Z" },
  ]);

  assert.deepEqual(
    ordered.map((item) => item.id),
    [1, 2, 3]
  );
});
