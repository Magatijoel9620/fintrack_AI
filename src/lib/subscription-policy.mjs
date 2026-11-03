export function trialDaysRemaining(end, now = Date.now()) {
  if (!end) return null;
  const date = end instanceof Date
    ? end
    : end && typeof end === "object" && typeof end.toDate === "function"
      ? end.toDate()
      : new Date(end);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - now) / 86400000));
}
export function trialIsActive(end, now = Date.now()) {
  const days = trialDaysRemaining(end, now);
  return days !== null && days > 0;
}

export function businessWritesAllowed(subscription, now = Date.now()) {
  if (!subscription || typeof subscription !== "object") return true;
  if (subscription.status === "active") return true;
  const rawEnd = subscription.trialEndsAt;
  if (!rawEnd) return true;
  // Firestore stores Timestamp values for trialEndsAt. Mirror the rules: only
  // a real Timestamp/Date can prove expiry. Legacy strings/numbers are treated
  // as unknown rather than producing a client-only lock that rules do not share.
  const end = rawEnd instanceof Date
    ? rawEnd.getTime()
    : rawEnd && typeof rawEnd === "object" && typeof rawEnd.toDate === "function"
      ? rawEnd.toDate().getTime()
      : Number.NaN;
  return !Number.isFinite(end) || end > now;
}
