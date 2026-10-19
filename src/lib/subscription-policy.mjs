export function trialDaysRemaining(end, now = Date.now()) {
  if (!end) return null;
  const date = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - now) / 86400000));
}
export function trialIsActive(end, now = Date.now()) {
  const days = trialDaysRemaining(end, now);
  return days !== null && days > 0;
}
