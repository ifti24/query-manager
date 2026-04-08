export interface QueryAgeInfo {
  ageFromCreation: string;
  ageFromLastActivity: string;
  lastActivityDate: string | null;
}

export function calculateQueryAge(
  createdAt: string,
  lastActivityAt: string | null
): QueryAgeInfo {
  const now = new Date();
  const created = new Date(createdAt);
  const lastActivity = lastActivityAt ? new Date(lastActivityAt) : null;

  const ageFromCreation = formatDuration(now.getTime() - created.getTime());
  const ageFromLastActivity = lastActivity
    ? formatDuration(now.getTime() - lastActivity.getTime())
    : 'No activity yet';

  return {
    ageFromCreation,
    ageFromLastActivity,
    lastActivityDate: lastActivityAt,
  };
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0 && hours < 24) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return 'Just now';
}
