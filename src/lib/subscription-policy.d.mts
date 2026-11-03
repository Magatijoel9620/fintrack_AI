export function trialDaysRemaining(
  end: Date | string | number | { toDate?: () => Date } | null | undefined,
  now?: number,
): number | null;
export function trialIsActive(
  end: Date | string | number | { toDate?: () => Date } | null | undefined,
  now?: number,
): boolean;

export function businessWritesAllowed(
  subscription: { status?: string; trialEndsAt?: Date | string | number | { toDate?: () => Date } } | null | undefined,
  now?: number,
): boolean;
