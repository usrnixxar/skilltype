/**
 * Indian Standard Time (IST) Date and Reset Utilities for Backend
 * Timezone: Asia/Kolkata (UTC +5:30)
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getKolkataComponents(d = new Date()) {
  const date = typeof d === 'number' ? new Date(d) : d;
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);

  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth() + 1,
    day: istDate.getUTCDate(),
    dayOfWeek: istDate.getUTCDay(), // 0 = Sunday, 6 = Saturday
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
    seconds: istDate.getUTCSeconds(),
    timeMs: date.getTime(),
  };
}

export function getDayId(d = new Date()) {
  const c = getKolkataComponents(d);
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
}

export function getWeekId(d = new Date()) {
  const c = getKolkataComponents(d);

  // Find Sunday midnight that began the current competition week
  const istDateMidnight = new Date(Date.UTC(c.year, c.month - 1, c.day));
  const sundayMidnight = new Date(istDateMidnight.getTime() - c.dayOfWeek * 86400000);

  const sunYear = sundayMidnight.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(sunYear, 0, 1));
  const dayOfYear = Math.floor((sundayMidnight.getTime() - startOfYear.getTime()) / 86400000);
  const weekNum = Math.floor(dayOfYear / 7) + 1;

  return `${sunYear}-W${String(weekNum).padStart(2, '0')}`;
}
