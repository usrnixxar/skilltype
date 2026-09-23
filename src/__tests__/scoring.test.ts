import { describe, it, expect } from 'vitest';

describe('Scoring and Formula Logic', () => {
  function computeMultiplier(cleanWordStreak: number): number {
    if (cleanWordStreak >= 20) return 4;
    if (cleanWordStreak >= 10) return 3;
    if (cleanWordStreak >= 5) return 2;
    return 1;
  }

  function computeAccuracy(correct: number, incorrect: number): { percent: number; display: string } {
    const total = correct + incorrect;
    if (total === 0) return { percent: 0, display: '—' };
    const percent = Math.round((correct / total) * 100);
    return { percent, display: `${percent}%` };
  }

  function computeWPM(correctChars: number, activePlayTimeMs: number): { wpm: number; display: string } {
    const activeMinutes = activePlayTimeMs / 60000;
    if (activeMinutes <= 0.05 || correctChars === 0) {
      return { wpm: 0, display: '—' };
    }
    const wpm = Math.round((correctChars / 5) / activeMinutes);
    return { wpm, display: `${wpm}` };
  }

  it('correctly ramps combo multipliers at 5, 10, and 20 clean words', () => {
    expect(computeMultiplier(0)).toBe(1);
    expect(computeMultiplier(4)).toBe(1);
    expect(computeMultiplier(5)).toBe(2);
    expect(computeMultiplier(9)).toBe(2);
    expect(computeMultiplier(10)).toBe(3);
    expect(computeMultiplier(19)).toBe(3);
    expect(computeMultiplier(20)).toBe(4);
    expect(computeMultiplier(50)).toBe(4);
  });

  it('accurately calculates typing accuracy and prevents NaN', () => {
    // Zero keystrokes displays em dash
    expect(computeAccuracy(0, 0)).toEqual({ percent: 0, display: '—' });

    // 100% accuracy
    expect(computeAccuracy(50, 0)).toEqual({ percent: 100, display: '100%' });

    // Partial accuracy
    expect(computeAccuracy(90, 10)).toEqual({ percent: 90, display: '90%' });
  });

  it('accurately calculates WPM based on 5 characters per word and active time', () => {
    // Zero time or zero characters displays em dash
    expect(computeWPM(0, 0)).toEqual({ wpm: 0, display: '—' });
    expect(computeWPM(10, 1000)).toEqual({ wpm: 0, display: '—' }); // Under 3s threshold

    // 300 correct characters in 1 minute = 60 WPM
    expect(computeWPM(300, 60000)).toEqual({ wpm: 60, display: '60' });

    // 600 correct characters in 2 minutes = 60 WPM
    expect(computeWPM(600, 120000)).toEqual({ wpm: 60, display: '60' });
  });
});
