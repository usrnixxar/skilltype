import { getKolkataComponents } from './dateUtils';

let serverOffsetMs = 0;
export function syncCompetitionClock(serverTime: number) {
  if (Number.isFinite(serverTime)) serverOffsetMs = serverTime - Date.now();
}
export function competitionNow() { return Date.now() + serverOffsetMs; }
export function isSundayPractice(at = competitionNow()) {
  return getKolkataComponents(at).dayOfWeek === 0;
}
