import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePlayerName,
  generatePlayerId,
  createPlayerProfile,
  loadActivePlayer,
  loadAllLocalPlayers,
} from '../utils/playerProfile';
import { compareLeaderboardRuns } from '../utils/leaderboardApi';

describe('Player Profile Management', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
      length: 0,
      key: () => null,
    } as unknown as Storage;

    (globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage;
  });

  it('validates player names correctly', () => {
    // 2 to 24 chars, supports spaces
    expect(validatePlayerName('Maverick').valid).toBe(true);
    expect(validatePlayerName('Alex Chen').valid).toBe(true);
    expect(validatePlayerName('  Sarah Connor  ').trimmedName).toBe('Sarah Connor');
    expect(validatePlayerName('  Sarah Connor  ').valid).toBe(true);
    expect(validatePlayerName('Ab').valid).toBe(true); // exactly 2 chars

    // Invalid: too short or empty
    expect(validatePlayerName('').valid).toBe(false);
    expect(validatePlayerName(' ').valid).toBe(false);
    expect(validatePlayerName('A').valid).toBe(false);

    // Invalid: over 24 characters
    const longName = 'ThisNameIsWayTooLongToBeValid123';
    expect(validatePlayerName(longName).valid).toBe(false);
  });

  it('generates unique player IDs starting with usr_', () => {
    const id1 = generatePlayerId();
    const id2 = generatePlayerId();
    expect(id1.startsWith('usr_')).toBe(true);
    expect(id2.startsWith('usr_')).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it('distinct profiles with identical display names have separate IDs and never merge', () => {
    const p1 = createPlayerProfile('Alex');
    const p2 = createPlayerProfile('Alex');

    expect(p1.name).toBe('Alex');
    expect(p2.name).toBe('Alex');
    expect(p1.id).not.toBe(p2.id);

    const all = loadAllLocalPlayers();
    expect(all.length).toBe(2);
    expect(all[0].id).toBe(p2.id);
    expect(all[1].id).toBe(p1.id);
  });

  it('saves and loads active player profile', () => {
    expect(loadActivePlayer()).toBeNull();

    const profile = createPlayerProfile('Starfighter');
    expect(loadActivePlayer()?.name).toBe('Starfighter');
    expect(loadActivePlayer()?.id).toBe(profile.id);

    // Switching active player
    const profile2 = createPlayerProfile('Wingman');
    expect(loadActivePlayer()?.name).toBe('Wingman');
    expect(loadActivePlayer()?.id).toBe(profile2.id);
  });
});

describe('Weekly Leaderboard Ranking & Tie-Breaking Rules', () => {
  it('ranks higher WPM first regardless of score', () => {
    const run1 = { wpm: 75, score: 9000, accuracy: 98, completedAt: 1000 };
    const run2 = { wpm: 80, score: 4000, accuracy: 90, completedAt: 2000 };

    const sorted = [run1, run2].sort(compareLeaderboardRuns);
    expect(sorted[0].wpm).toBe(80);
    expect(sorted[1].wpm).toBe(75);
  });

  it('breaks WPM ties using higher Score first', () => {
    const run1 = { wpm: 80, score: 5000, accuracy: 95, completedAt: 1000 };
    const run2 = { wpm: 80, score: 6200, accuracy: 90, completedAt: 2000 };

    const sorted = [run1, run2].sort(compareLeaderboardRuns);
    expect(sorted[0].score).toBe(6200);
    expect(sorted[1].score).toBe(5000);
  });

  it('breaks WPM and Score ties using higher Accuracy first', () => {
    const run1 = { wpm: 80, score: 5000, accuracy: 95, completedAt: 1000 };
    const run2 = { wpm: 80, score: 5000, accuracy: 99, completedAt: 2000 };

    const sorted = [run1, run2].sort(compareLeaderboardRuns);
    expect(sorted[0].accuracy).toBe(99);
    expect(sorted[1].accuracy).toBe(95);
  });

  it('breaks complete ties using earlier completedAt timestamp', () => {
    const runEarlier = { wpm: 80, score: 5000, accuracy: 98, completedAt: 1000 };
    const runLater = { wpm: 80, score: 5000, accuracy: 98, completedAt: 2000 };

    const sorted = [runLater, runEarlier].sort(compareLeaderboardRuns);
    expect(sorted[0].completedAt).toBe(1000);
    expect(sorted[1].completedAt).toBe(2000);
  });

  it('properly sorts a complex multi-player leaderboard according to all 4 rules', () => {
    const players = [
      { name: 'A', wpm: 60, score: 2000, accuracy: 90, completedAt: 100 },
      { name: 'B', wpm: 90, score: 4000, accuracy: 95, completedAt: 100 },
      { name: 'C', wpm: 90, score: 5000, accuracy: 92, completedAt: 100 },
      { name: 'D', wpm: 90, score: 5000, accuracy: 98, completedAt: 200 },
      { name: 'E', wpm: 90, score: 5000, accuracy: 98, completedAt: 150 }, // Beats D on timestamp
      { name: 'F', wpm: 105, score: 7000, accuracy: 99, completedAt: 500 }, // Overall #1
    ];

    const sorted = [...players].sort(compareLeaderboardRuns);
    expect(sorted.map(p => p.name)).toEqual(['F', 'E', 'D', 'C', 'B', 'A']);
  });
});
