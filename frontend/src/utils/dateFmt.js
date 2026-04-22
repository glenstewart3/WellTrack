/**
 * Timezone-aware date formatter. Reads `timezone` from the provided settings
 * object (defaulting to Australia/Melbourne) and returns locale-aware strings.
 * Designed as a plain helper so it can be used inside components without
 * pulling in context in every caller.
 */
export function formatDate(iso, settings = {}, opts = {}) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, {
      timeZone: settings.timezone || 'Australia/Melbourne',
      ...opts,
    });
  } catch {
    return String(iso);
  }
}

export function formatTime(iso, settings = {}, opts = {}) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleTimeString(undefined, {
      timeZone: settings.timezone || 'Australia/Melbourne',
      hour: '2-digit',
      minute: '2-digit',
      ...opts,
    });
  } catch {
    return String(iso);
  }
}

export function formatDateTime(iso, settings = {}) {
  return `${formatDate(iso, settings)} ${formatTime(iso, settings)}`;
}
