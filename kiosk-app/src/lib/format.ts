export function formatTime(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

export function formatDateLabel(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}

export function formatRelativeTime(dateIso: string | null): string {
  if (!dateIso) {
    return "Not synced yet";
  }

  const value = new Date(dateIso);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - value.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Synced just now";
  }

  if (diffMinutes < 60) {
    return `Synced ${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return `Synced ${diffHours}h ago`;
}

export function formatActionLabel(action: "clock-in" | "clock-out"): string {
  return action === "clock-in" ? "Clock in" : "Clock out";
}

export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
