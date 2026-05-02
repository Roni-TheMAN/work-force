import type { ClockEventType } from "../types/offlineClock";
import type { ClockActionType } from "../types/kiosk";

export function resolveActionFromLatestLocalEvent(
  latestType: ClockEventType | null | undefined,
  fallbackAction: ClockActionType
): ClockActionType {
  if (!latestType) {
    return fallbackAction;
  }

  return latestType === "IN" ? "clock-out" : "clock-in";
}

export function assertNoDuplicateLocalEvent(
  latestType: ClockEventType | null | undefined,
  requestedType: ClockEventType
): void {
  if (latestType !== requestedType) {
    return;
  }

  throw new Error(requestedType === "IN" ? "duplicate_clock_in" : "duplicate_clock_out");
}

export function computeRetryDelayMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(Math.max(attempts, 0), 20));
}

export function sortOutboxForSync<T extends { createdAt: string; id: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const createdAtComparison = left.createdAt.localeCompare(right.createdAt);

    if (createdAtComparison !== 0) {
      return createdAtComparison;
    }

    return left.id - right.id;
  });
}
