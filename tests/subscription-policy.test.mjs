import test from "node:test";
import assert from "node:assert/strict";
import { trialDaysRemaining, trialIsActive, businessWritesAllowed } from "../src/lib/subscription-policy.mjs";

test("trial is 21 days when its end is exactly 21 days away", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(trialDaysRemaining(now + 21 * 86400000, now), 21);
});
test("trial rounds partial days up", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(trialDaysRemaining(now + 1, now), 1);
});
test("Firestore Timestamp-like trial dates are converted correctly", () => {
  const now = Date.UTC(2026, 0, 1);
  const end = new Date(now + 2 * 86400000);
  assert.equal(trialDaysRemaining({ toDate: () => end }, now), 2);
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


test("an active paid subscription stays writable after the original trial end", () => {
  const now = Date.UTC(2026, 10, 3);
  assert.equal(businessWritesAllowed({ status: "active", trialEndsAt: new Date(now - 86400000) }, now), true);
});

test("an unexpired trial remains writable", () => {
  const now = Date.UTC(2026, 10, 3);
  assert.equal(businessWritesAllowed({ status: "trialing", trialEndsAt: new Date(now + 1) }, now), true);
});

test("an elapsed trial pauses writes until the account becomes paid-active", () => {
  const now = Date.UTC(2026, 10, 3);
  assert.equal(businessWritesAllowed({ status: "trialing", trialEndsAt: new Date(now - 1) }, now), false);
  assert.equal(businessWritesAllowed({ status: "expired", trialEndsAt: new Date(now - 1) }, now), false);
});

test("missing or invalid legacy trial metadata does not lock the workspace", () => {
  const now = Date.UTC(2026, 10, 3);
  assert.equal(businessWritesAllowed(undefined, now), true);
  assert.equal(businessWritesAllowed({ status: "trialing", trialEndsAt: "invalid" }, now), true);
  assert.equal(businessWritesAllowed({ status: "trialing", trialEndsAt: new Date(now - 1).toISOString() }, now), true);
});
