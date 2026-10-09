import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWeeklyLeaderboard } from '../utils/leaderboardApi';
import { getSupabaseClient } from '../utils/supabaseClient';

vi.mock('../utils/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));
const adminId = '5c99b1c8-e130-4c27-a750-88e35362c581';
const rows = ['first', adminId, 'second'].map((id, index) => ({
  id, player_id: id, player_name: id, rank: index + 1,
  weekly_points: 30 - index, daily_points: 30 - index,
}));

afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe.each(['weekly', 'daily'] as const)('%s leaderboard without admin', (type) => {
  it.each(['supabase', 'backend'])('keeps contiguous ranks and excludes admin personal row via %s', async (source) => {
    if (source === 'supabase') {
      const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      vi.mocked(getSupabaseClient).mockReturnValue({ from: () => query } as any);
    } else {
      vi.mocked(getSupabaseClient).mockReturnValue(null);
      vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
        entries: rows.map(row => ({ ...row })), totalEligible: 3, playerRank: rows[1],
      }) })));
    }
    const result = await fetchWeeklyLeaderboard('second', type);
    expect(result.entries.map(entry => [entry.playerId, entry.rank])).toEqual([['first', 1], ['second', 2]]);
    expect(result.totalEligible).toBe(2);
    expect(result.playerRank?.rank).toBe(2);
    const admin = await fetchWeeklyLeaderboard(adminId, type);
    expect(admin.playerRank).toBeNull();
  });
});
