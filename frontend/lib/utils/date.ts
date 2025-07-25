/**
 * Date formatting utilities
 *
 * Consistent date formatting to avoid hydration mismatches
 */

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) {
    return "Unknown date";
  }

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return "Invalid date";
    }

    // Use a consistent format that doesn't depend on locale
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");

    return `${month} ${day}, ${hours}:${minutes}`;
  } catch {
    return "Invalid date";
  }
}

export function formatRelativeTime(
  date: string | Date | null | undefined,
): string {
  if (!date) {
    return "Unknown";
  }

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return "Invalid date";
    }

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "just now";
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return formatDate(d);
  } catch {
    return "Invalid date";
  }
}

export function safeLocaleDateString(
  date: string | Date | null | undefined,
): string {
  if (!date) {
    return "Unknown date";
  }

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return "Invalid date";
    }
    return d.toLocaleDateString();
  } catch {
    return "Invalid date";
  }
}

export function safeLocaleString(
  date: string | Date | null | undefined,
): string {
  if (!date) {
    return "Unknown date";
  }

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return "Invalid date";
    }
    return d.toLocaleString();
  } catch {
    return "Invalid date";
  }
}
