/**
 * Indian Standard Time (IST) Date and Reset Utilities
 * Timezone: Asia/Kolkata (UTC +5:30)
 *
 * Competition Week Cycle:
 * - Begins: Sunday 00:00:00 IST
 * - Ends: Saturday 23:59:59 IST (resets automatically at Saturday 11:59 PM IST)
 *
 * Daily Cycle:
 * - Begins: 00:00:00 IST
 * - Ends: 23:59:59 IST
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5 hours 30 mins

export interface KolkataTimeComponents {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hours: number;
  minutes: number;
  seconds: number;
  timeMs: number;
}

/**
 * Decompose a timestamp or Date into its exact calendar components in Asia/Kolkata (IST).
 */
export function getKolkataComponents(d: Date | number = new Date()): KolkataTimeComponents {
  const date = typeof d === 'number' ? new Date(d) : d;
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);

  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth() + 1,
    day: istDate.getUTCDate(),
    dayOfWeek: istDate.getUTCDay(),
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
    seconds: istDate.getUTCSeconds(),
    timeMs: date.getTime(),
  };
}

/**
 * Returns formatted Day ID in Asia/Kolkata: YYYY-MM-DD
 * Example: '2026-10-03'
 */
export function getDayId(d: Date | number = new Date()): string {
  const c = getKolkataComponents(d);
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
}

/**
 * Returns standardized Week ID in Asia/Kolkata: YYYY-Www
 * Week boundaries:
 *   - Starts: Sunday 00:00:00 IST
 *   - Ends: Saturday 23:59:59 IST (Weekly Reset at Saturday 11:59 PM IST)
 * Example: '2026-W39', '2026-W40'
 */
export function getWeekId(d: Date | number = new Date()): string {
  const c = getKolkataComponents(d);

  // Find the Sunday midnight that began the current competition week
  const istDateMidnight = new Date(Date.UTC(c.year, c.month - 1, c.day));
  const sundayMidnight = new Date(istDateMidnight.getTime() - c.dayOfWeek * 86400000);

  const sunYear = sundayMidnight.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(sunYear, 0, 1));
  const dayOfYear = Math.floor((sundayMidnight.getTime() - startOfYear.getTime()) / 86400000);
  const weekNum = Math.floor(dayOfYear / 7) + 1;

  return `${sunYear}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Calculate time remaining until the upcoming Saturday 11:59:59 PM IST reset.
 */
export function getTimeUntilSaturdayReset(d: Date | number = new Date()): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  formatted: string;
} {
  const c = getKolkataComponents(d);
  // Saturday is dayOfWeek = 6
  let daysUntilSaturday = 6 - c.dayOfWeek;
  if (daysUntilSaturday < 0) daysUntilSaturday = 6;

  // Calculate upcoming Saturday 23:59:59 IST
  const currentIstDayStart = new Date(Date.UTC(c.year, c.month - 1, c.day));
  const targetSaturdayMidnight = new Date(
    currentIstDayStart.getTime() + daysUntilSaturday * 86400000 + (23 * 3600 + 59 * 60 + 59) * 1000
  );

  const targetUtcMs = targetSaturdayMidnight.getTime() - IST_OFFSET_MS;
  const currentUtcMs = typeof d === 'number' ? d : d.getTime();
  const diffMs = Math.max(0, targetUtcMs - currentUtcMs);

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const formatted =
    days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : `${hours}h ${minutes}m ${seconds}s`;

  return { days, hours, minutes, seconds, totalMs: diffMs, formatted };
}
