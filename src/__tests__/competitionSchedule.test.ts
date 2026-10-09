import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSundayPractice, syncCompetitionClock } from '../utils/competitionClock';
import { getWeekId } from '../utils/dateUtils';

afterEach(() => { vi.useRealTimers(); syncCompetitionClock(Date.now()); });
describe('Competition schedule in India', () => {
  it.each([
    ['2026-10-10T23:59:59.999+05:30', false],
    ['2026-10-11T00:00:00+05:30', true],
    ['2026-10-11T23:59:59.999+05:30', true],
    ['2026-10-12T00:00:00+05:30', false],
    ['2027-01-03T00:00:00+05:30', true],
  ])('uses the correct boundary at %s', (time, paused) => {
    expect(isSundayPractice(Date.parse(time))).toBe(paused);
  });
  it('uses the server clock even if the device is on another day', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T12:00:00+05:30'));
    syncCompetitionClock(Date.parse('2026-10-11T23:59:59+05:30'));
    expect(isSundayPractice()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(isSundayPractice()).toBe(false);
  });
  it('keeps historical week IDs across the year boundary', () => {
    expect(getWeekId(Date.parse('2027-01-02T23:59:59+05:30'))).toBe('2026-W52');
    expect(getWeekId(Date.parse('2027-01-03T00:00:00+05:30'))).toBe('2027-W01');
  });
});
