import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePlayerName,
  generatePlayerId,
  generateUuid,
  saveActivePlayer,
  clearActivePlayer,
  maskPlayerName,
  loadActivePlayer,
  loadAllLocalPlayers,
  getPlayerName,
  getPlayerId,
  removeSavedLogin,
  STORAGE_KEY_ACTIVE_PLAYER,
  STORAGE_KEY_PLAYER_NAME,
  STORAGE_KEY_PLAYER_ID,
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
    globalThis.sessionStorage = mockStorage;
    clearActivePlayer();
  });

  it('validates player names correctly', () => {
    // 2 to 25 chars, supports spaces
    expect(validatePlayerName('Maverick').valid).toBe(true);
    expect(validatePlayerName('Alex Chen').valid).toBe(true);
    expect(validatePlayerName('Rahul Kumar').valid).toBe(true);
    expect(validatePlayerName('  Sarah Connor  ').trimmedName).toBe('Sarah Connor');
    expect(validatePlayerName('  Sarah Connor  ').valid).toBe(true);
    expect(validatePlayerName('Ab').valid).toBe(true); // exactly 2 chars

    // Invalid: too short or empty
    expect(validatePlayerName('').valid).toBe(false);
    expect(validatePlayerName(' ').valid).toBe(false);
    expect(validatePlayerName('A').valid).toBe(false);

    // Invalid: over 25 characters
    const longName = 'ThisNameIsWayTooLongToBeValid123456';
    expect(validatePlayerName(longName).valid).toBe(false);
  });

  it('generates standard UUID format for player IDs', () => {
    const id1 = generatePlayerId();
    const id2 = generatePlayerId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(id1)).toBe(true);
    expect(uuidRegex.test(id2)).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it('requires logout before switching profiles and stores no switch list', () => {
    const one = { id: generateUuid(), name: 'A**x', kind: 'guest' as const, sessionToken: 'a'.repeat(64), createdAt: Date.now() };
    const two = { ...one, id: generateUuid(), sessionToken: 'b'.repeat(64) };
    saveActivePlayer(one);
    expect(loadActivePlayer()?.id).toBe(one.id);
    expect(() => saveActivePlayer(two)).toThrow('Log out');
    expect(loadAllLocalPlayers()).toEqual([]);
    clearActivePlayer();
    expect(loadActivePlayer()).toBeNull();
    saveActivePlayer(two);
    expect(loadActivePlayer()?.id).toBe(two.id);
  });
  it('requires old profiles to log in again', () => {
    localStorage.setItem(STORAGE_KEY_PLAYER_NAME, 'Old Name');
    localStorage.setItem(STORAGE_KEY_PLAYER_ID, generateUuid());
    expect(loadActivePlayer()).toBeNull();
  });
  it('masks every name part without revealing short names', () => {
    expect(maskPlayerName('Nisar Ansari')).toBe('N***r A****i');
    expect(maskPlayerName('Md Nisar')).toBe('M* N***r');
    expect(maskPlayerName('N***r A****i')).toBe('N***r A****i');
  });

  it('uses only the current page identity or explicit fallback, not stored names', () => {
    localStorage.setItem(STORAGE_KEY_PLAYER_NAME, 'Old User');
    expect(getPlayerName()).toBe('');
    expect(getPlayerName('  Rehan  ')).toBe('Rehan');
    saveActivePlayer({id:'server-id',name:'Nisar',createdAt:0,pin:'123456',sessionToken:'a'.repeat(64)});
    expect(getPlayerName()).toBe('Nisar');
    expect(getPlayerId()).toBe('server-id');
    expect(loadActivePlayer()?.pin).toBeUndefined();
    expect(Object.keys(mockStore)).toHaveLength(0);
  });
  it('keeps fallback IDs in memory only and forgets them on logout', () => {
    const first = getPlayerId();
    expect(getPlayerId()).toBe(first);
    expect(localStorage.getItem(STORAGE_KEY_PLAYER_ID)).toBeNull();
    clearActivePlayer();
    expect(getPlayerId()).not.toBe(first);
  });
  it('purges old saved login credentials without removing settings', () => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PLAYER, JSON.stringify({pin:'123456',sessionToken:'a'.repeat(64)}));
    localStorage.setItem('skilltype_settings', 'preserve');
    removeSavedLogin();
    expect(localStorage.getItem(STORAGE_KEY_ACTIVE_PLAYER)).toBeNull();
    expect(localStorage.getItem('skilltype_settings')).toBe('preserve');
  });

});

describe('Weekly Leaderboard Ranking & Tie-Breaking Rules', () => {
  it('ranks higher points first (Highest Weekly Points = Rank #1)', () => {
    const player1 = { weeklyPoints: 5400, bestWpm: 49, bestAccuracy: 95, lastPlayedAt: 1000 };
    const player2 = { weeklyPoints: 5800, bestWpm: 52, bestAccuracy: 98, lastPlayedAt: 2000 };

    const sorted = [player1, player2].sort(compareLeaderboardRuns);
    expect(sorted[0].weeklyPoints).toBe(5800);
    expect(sorted[1].weeklyPoints).toBe(5400);
  });

  it('breaks Points ties using higher Best WPM first', () => {
    const player1 = { weeklyPoints: 5000, bestWpm: 45, bestAccuracy: 95, lastPlayedAt: 1000 };
    const player2 = { weeklyPoints: 5000, bestWpm: 55, bestAccuracy: 90, lastPlayedAt: 2000 };

    const sorted = [player1, player2].sort(compareLeaderboardRuns);
    expect(sorted[0].bestWpm).toBe(55);
    expect(sorted[1].bestWpm).toBe(45);
  });

  it('breaks Points and WPM ties using higher Accuracy first', () => {
    const player1 = { weeklyPoints: 5000, bestWpm: 50, bestAccuracy: 92, lastPlayedAt: 1000 };
    const player2 = { weeklyPoints: 5000, bestWpm: 50, bestAccuracy: 98, lastPlayedAt: 2000 };

    const sorted = [player1, player2].sort(compareLeaderboardRuns);
    expect(sorted[0].bestAccuracy).toBe(98);
    expect(sorted[1].bestAccuracy).toBe(92);
  });

  it('breaks complete ties using earlier timestamp', () => {
    const playerEarlier = { weeklyPoints: 5000, bestWpm: 50, bestAccuracy: 98, lastPlayedAt: 1000 };
    const playerLater = { weeklyPoints: 5000, bestWpm: 50, bestAccuracy: 98, lastPlayedAt: 2000 };

    const sorted = [playerLater, playerEarlier].sort(compareLeaderboardRuns);
    expect(sorted[0].lastPlayedAt).toBe(1000);
    expect(sorted[1].lastPlayedAt).toBe(2000);
  });

  it('properly sorts a complex multi-player leaderboard according to all 4 rules', () => {
    const players = [
      { name: 'Nisar', weeklyPoints: 5800, bestWpm: 52, bestAccuracy: 98, lastPlayedAt: 100 },
      { name: 'Rehan', weeklyPoints: 5400, bestWpm: 49, bestAccuracy: 95, lastPlayedAt: 100 },
      { name: 'Aman', weeklyPoints: 4200, bestWpm: 47, bestAccuracy: 96, lastPlayedAt: 100 },
      { name: 'Rahul', weeklyPoints: 3900, bestWpm: 43, bestAccuracy: 92, lastPlayedAt: 100 },
      { name: 'TiedHigherWpm', weeklyPoints: 3900, bestWpm: 48, bestAccuracy: 90, lastPlayedAt: 100 },
    ];

    const sorted = [...players].sort(compareLeaderboardRuns);
    expect(sorted.map((p) => p.name)).toEqual([
      'Nisar',
      'Rehan',
      'Aman',
      'TiedHigherWpm', // 3900 pts, 48 WPM beats Rahul with 43 WPM
      'Rahul',
    ]);
  });
});
