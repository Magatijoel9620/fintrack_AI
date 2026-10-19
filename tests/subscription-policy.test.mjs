import test from "node:test";
import assert from "node:assert/strict";
import { trialDaysRemaining, trialIsActive } from "../src/lib/subscription-policy.mjs";

test("trial is 21 days when its end is exactly 21 days away", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(trialDaysRemaining(now + 21 * 86400000, now), 21);
});
test("trial rounds partial days up", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(trialDaysRemaining(now + 1, now), 1);
});
test("expired trial has zero days and is inactive", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(trialDaysRemaining(now - 1, now), 0);
  assert.equal(trialIsActive(now - 1, now), false);
});
test("missing or invalid trial date is unknown, not active", () => {
  assert.equal(trialDaysRemaining(undefined), null);
  assert.equal(trialIsActive("not-a-date"), false);
});
