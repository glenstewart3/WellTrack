/**
 * Timezone-aware date formatter. Reads `timezone` from the provided settings
 * object (defaulting to Australia/Melbourne) and returns locale-aware strings.
 * Designed as a plain helper so it can be used inside components without
 * pulling in context in every caller.
 */

/**
 * Return today's date as YYYY-MM-DD in the LOCAL timezone (not UTC).
 * Using `new Date().toISOString().split('T')[0]` drops to UTC, which causes
 * off-by-one bugs in places like Melbourne (UTC+11) where during local morning
 * UTC is still "yesterday" and during local late evening UTC is "tomorrow".
 */
export function todayLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysLocal(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return todayLocal(dt);
}

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

export function timeAgo(iso) {
  if (!iso) return '';
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDate(iso);
}
