// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizePlayerName,
  upsertPlayer,
  recordCompletedRun,
  getWeeklyLeaderboard,
  getDailyLeaderboard,
  resetInMemoryDatabase,
  compareLeaderboardEntries,
  compareRuns,
} from '../../api/lib/db.js';
import healthHandler from '../../api/health.js';
import leaderboardHandler from '../../api/leaderboard.js';
import playersHandler from '../../api/players.js';
import runsHandler from '../../api/runs.js';

// Helper mock response object matching both Vercel and Node ServerResponse
function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
    setHeader(key: string, value: string) {
      res.headers[key.toLowerCase()] = value;
    },
    writeHead(code: number, headers?: Record<string, string>) {
      res.statusCode = code;
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => {
          res.headers[k.toLowerCase()] = v;
        });
      }
    },
    end(data?: string) {
      if (data && typeof data === 'string' && !res.body) {
        try {
          res.body = JSON.parse(data);
        } catch {
          res.body = data;
        }
      }
    },
  };
  return res;
}

describe('SkillType Leaderboard Backend and Persistence', () => {
  beforeEach(() => {
    resetInMemoryDatabase();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('rejects production reads and saves without durable storage', async () => {
    for (const key of ['POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'DATABASE_URL', 'NEON_DATABASE_URL']) vi.stubEnv(key, '');
    vi.stubEnv('VERCEL', '1');
    await expect(getWeeklyLeaderboard()).rejects.toThrow('storage is not configured');
    const req = { method: 'POST', body: { runId: 'unsaved', playerId: 'p1', playerName: 'Nisar', score: 100, wpm: 25, accuracy: 100 } };
    const res = createMockResponse();
    await runsHandler(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.success).not.toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
    vi.stubEnv('VERCEL', '');
    expect((await getWeeklyLeaderboard()).entries).toHaveLength(0);
  });

  describe('Player Name Sanitization & Validation', () => {
    it('sanitizes player names by stripping HTML and control characters', () => {
      expect(sanitizePlayerName('<b>Nisar</b>')).toBe('Nisar');
      expect(sanitizePlayerName('Pilot\x00\x1F')).toBe('Pilot');
      expect(sanitizePlayerName('   Commander Shephard   ')).toBe('Commander Shephard');
    });

    it('rejects names with less than 2 characters or greater than 25 characters', async () => {
      await expect(upsertPlayer('p1', 'A')).rejects.toThrow();
      await expect(upsertPlayer('p1', '')).rejects.toThrow();
      await expect(upsertPlayer('p1', '   ')).rejects.toThrow();
      await expect(upsertPlayer('p1', 'ThisNameIsFarTooLongForSkillType12345')).rejects.toThrow();
    });

    it('creates a new player and updates lastSeenAt/name when existing', async () => {
      const p1 = await upsertPlayer('p1', 'Nisar');
      expect(p1.id).toBe('p1');
      expect(p1.name).toBe('Nisar');
      expect(p1.createdAt).toBeGreaterThan(0);

      const p1Updated = await upsertPlayer('p1', 'Nisar Updated');
      expect(p1Updated.id).toBe('p1');
      expect(p1Updated.name).toBe('Nisar Updated');
      expect(p1Updated.createdAt).toBe(p1.createdAt);
      expect(p1Updated.lastSeenAt).toBeGreaterThanOrEqual(p1.lastSeenAt);
    });
  });

  describe('Run Recording & Duplicate Prevention', () => {
    it('server generates completedAt and rejects client-provided timestamps', async () => {
      const runData = {
        runId: 'run_test_1',
        playerId: 'p_nisar',
        playerName: 'Nisar',
        wpm: 65,
        score: 5200,
        accuracy: 98,
        wave: 5,
        wordsCompleted: 24,
        durationSeconds: 120,
        completedAt: 1000, // untrusted client timestamp
      };

      const result = await recordCompletedRun(runData);
      expect(result.success).toBe(true);
      expect(result.alreadyRecorded).toBe(false);
      expect(result.runId).toBe('run_test_1');
      // Server must stamp current time, not client 1000
      expect(result.completedAt).toBeGreaterThan(1700000000000);
      expect(result.completedAt).not.toBe(1000);
    });

    it('prevents duplicate run insertion using runId / gameSessionId (idempotent submission)', async () => {
      const run = {
        gameSessionId: 'session_unique_100',
        runId: 'session_unique_100',
        playerId: 'p1',
        playerName: 'Nisar',
        wpm: 70,
        score: 6000,
        accuracy: 99,
        wave: 6,
        wordsCompleted: 30,
        durationSeconds: 110,
      };

      const first = await recordCompletedRun(run);
      expect(first.success).toBe(true);
      expect(first.alreadyRecorded).toBe(false);

      const duplicate = await recordCompletedRun(run);
      expect(duplicate.success).toBe(true);
      expect(duplicate.alreadyRecorded).toBe(true);
      expect(duplicate.completedAt).toBe(first.completedAt);

      // Leaderboard should have only 1 entry with 6000 points, not duplicated 12000
      const lb = await getWeeklyLeaderboard();
      expect(lb.entries.length).toBe(1);
      expect(lb.entries[0].weeklyPoints).toBe(6000);
    });
  });

  describe('User Request Scenarios & Ranking Rules', () => {
    it('TEST 1 & 2: New player Nisar joins, scores 500, appears on leaderboard with 500 points', async () => {
      await recordCompletedRun({
        runId: 'game_1',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 32,
        score: 500,
        accuracy: 94,
      });

      const lb = await getWeeklyLeaderboard('usr_nisar');
      expect(lb.entries.length).toBe(1);
      expect(lb.entries[0].playerName).toBe('Nisar');
      expect(lb.entries[0].weeklyPoints).toBe(500);
      expect(lb.entries[0].bestWpm).toBe(32);
      expect(lb.entries[0].rank).toBe(1);
    });

    it('TEST 3: Nisar plays again and scores 700 -> Weekly Points: 1200, only ONE Nisar row', async () => {
      await recordCompletedRun({
        runId: 'game_1',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 32,
        score: 500,
        accuracy: 94,
      });

      await recordCompletedRun({
        runId: 'game_2',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 41,
        score: 700,
        accuracy: 96,
      });

      const lb = await getWeeklyLeaderboard('usr_nisar');
      expect(lb.entries.length).toBe(1); // exactly one row
      expect(lb.entries[0].playerName).toBe('Nisar');
      expect(lb.entries[0].weeklyPoints).toBe(1200); // 500 + 700
      expect(lb.entries[0].gamesPlayed).toBe(2);
    });

    it('TEST 4: Nisar WPM: Game 1 = 32, Game 2 = 41 -> Leaderboard WPM: 41', async () => {
      await recordCompletedRun({
        runId: 'game_1',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 32,
        score: 500,
        accuracy: 94,
      });

      await recordCompletedRun({
        runId: 'game_2',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 41,
        score: 700,
        accuracy: 96,
      });

      // Third game with lower WPM (38 WPM)
      await recordCompletedRun({
        runId: 'game_3',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 38,
        score: 400,
        accuracy: 95,
      });

      const lb = await getWeeklyLeaderboard('usr_nisar');
      // best_wpm = MAX(32, 41, 38) = 41
      expect(lb.entries[0].bestWpm).toBe(41);
      expect(lb.entries[0].weeklyPoints).toBe(1600);
    });

    it('TEST 5: Rehan scores 1500 -> Leaderboard automatically ranks #1 Rehan, #2 Nisar', async () => {
      // Nisar has 1200 points
      await recordCompletedRun({
        runId: 'nisar_run',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 41,
        score: 1200,
        accuracy: 95,
      });

      // Rehan scores 1500 points
      await recordCompletedRun({
        runId: 'rehan_run',
        playerId: 'usr_rehan',
        playerName: 'Rehan',
        wpm: 49,
        score: 1500,
        accuracy: 97,
      });

      const lb = await getWeeklyLeaderboard();
      expect(lb.entries.length).toBe(2);
      expect(lb.entries[0].playerName).toBe('Rehan');
      expect(lb.entries[0].weeklyPoints).toBe(1500);
      expect(lb.entries[0].rank).toBe(1);

      expect(lb.entries[1].playerName).toBe('Nisar');
      expect(lb.entries[1].weeklyPoints).toBe(1200);
      expect(lb.entries[1].rank).toBe(2);
    });

    it('breaks Points ties using Best WPM DESC', async () => {
      await recordCompletedRun({
        runId: 'r1',
        playerId: 'p1',
        playerName: 'LowerWpm',
        wpm: 40,
        score: 3000,
        accuracy: 95,
      });

      await recordCompletedRun({
        runId: 'r2',
        playerId: 'p2',
        playerName: 'HigherWpm',
        wpm: 55,
        score: 3000,
        accuracy: 90,
      });

      const lb = await getWeeklyLeaderboard();
      expect(lb.entries[0].playerName).toBe('HigherWpm');
      expect(lb.entries[1].playerName).toBe('LowerWpm');
    });

    it('breaks Points and WPM ties using Best Accuracy DESC', async () => {
      await recordCompletedRun({
        runId: 'r1',
        playerId: 'p1',
        playerName: 'Acc90',
        wpm: 50,
        score: 3000,
        accuracy: 90,
      });

      await recordCompletedRun({
        runId: 'r2',
        playerId: 'p2',
        playerName: 'Acc98',
        wpm: 50,
        score: 3000,
        accuracy: 98,
      });

      const lb = await getWeeklyLeaderboard();
      expect(lb.entries[0].playerName).toBe('Acc98');
      expect(lb.entries[1].playerName).toBe('Acc90');
    });

    it('TEST 8: Saturday 11:59 PM reset via week_id preserves history', async () => {
      // Week 1 (2026-W39)
      await recordCompletedRun({
        runId: 'w39_nisar',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 52,
        score: 5800,
        accuracy: 98,
        weekId: '2026-W39',
      });

      // Query Week 1
      const lbW39 = await getWeeklyLeaderboard(null, '2026-W39');
      expect(lbW39.entries.length).toBe(1);
      expect(lbW39.entries[0].playerName).toBe('Nisar');
      expect(lbW39.entries[0].weeklyPoints).toBe(5800);

      // Now query Next Week (2026-W40) before anyone has played
      const lbW40Before = await getWeeklyLeaderboard(null, '2026-W40');
      expect(lbW40Before.entries.length).toBe(0); // Clean reset, no old participants displayed

      // In Week 2, Rehan plays
      await recordCompletedRun({
        runId: 'w40_rehan',
        playerId: 'usr_rehan',
        playerName: 'Rehan',
        wpm: 49,
        score: 1200,
        accuracy: 97,
        weekId: '2026-W40',
      });

      const lbW40After = await getWeeklyLeaderboard(null, '2026-W40');
      expect(lbW40After.entries.length).toBe(1);
      expect(lbW40After.entries[0].playerName).toBe('Rehan');

      // Crucial: Old Week 1 (2026-W39) data remains safely preserved in history!
      const lbW39Historical = await getWeeklyLeaderboard(null, '2026-W39');
      expect(lbW39Historical.entries.length).toBe(1);
      expect(lbW39Historical.entries[0].playerName).toBe('Nisar');
      expect(lbW39Historical.entries[0].weeklyPoints).toBe(5800);
    });

    it('Daily Leaderboard tracks points for current day and resets on new day', async () => {
      // Day 1: 2026-10-03
      await recordCompletedRun({
        runId: 'd1_nisar',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 45,
        score: 600,
        accuracy: 96,
        dayId: '2026-10-03',
      });

      const dailyD1 = await getDailyLeaderboard(null, '2026-10-03');
      expect(dailyD1.entries.length).toBe(1);
      expect(dailyD1.entries[0].dailyPoints).toBe(600);

      // Next Day: 2026-10-04 (has 0 entries until played)
      const dailyD2Before = await getDailyLeaderboard(null, '2026-10-04');
      expect(dailyD2Before.entries.length).toBe(0);

      // On Day 2, Nisar plays morning (300) and afternoon (500)
      await recordCompletedRun({
        runId: 'd2_nisar_morning',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 48,
        score: 300,
        accuracy: 97,
        dayId: '2026-10-04',
      });

      await recordCompletedRun({
        runId: 'd2_nisar_afternoon',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 50,
        score: 500,
        accuracy: 98,
        dayId: '2026-10-04',
      });

      const dailyD2After = await getDailyLeaderboard(null, '2026-10-04');
      expect(dailyD2After.entries.length).toBe(1); // exactly one row
      expect(dailyD2After.entries[0].dailyPoints).toBe(800); // 300 + 500
      expect(dailyD2After.entries[0].bestWpm).toBe(50);
    });
  });

  describe('Vercel Serverless Function Endpoints', () => {
    it('GET /api/health reports absent persistent storage', async () => {
      const req = { method: 'GET' };
      const res = createMockResponse();

      await healthHandler(req as any, res as any);
      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual({
        status: 'unconfigured',
        persistentStorageConfigured: false,
        service: 'SkillType Leaderboard Service',
      });
    });

    it('POST /api/players registers and updates player profile', async () => {
      const req = {
        method: 'POST',
        body: { id: 'usr_nisar', name: 'Nisar' },
      };
      const res = createMockResponse();

      await playersHandler(req as any, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.player.id).toBe('usr_nisar');
      expect(res.body.player.name).toBe('Nisar');
    });

    it('POST /api/runs records run and prevents duplicate submissions', async () => {
      const req = {
        method: 'POST',
        body: {
          runId: 'run_api_test_1',
          playerId: 'usr_nisar',
          playerName: 'Nisar',
          wpm: 68,
          score: 5500,
          accuracy: 99,
          wave: 6,
          wordsCompleted: 28,
          durationSeconds: 100,
        },
      };
      const res1 = createMockResponse();
      await runsHandler(req as any, res1 as any);

      expect(res1.statusCode).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.alreadyRecorded).toBe(false);
      expect(res1.body.runId).toBe('run_api_test_1');
      expect(res1.body.completedAt).toBeGreaterThan(0);

      // Resubmit duplicate run
      const res2 = createMockResponse();
      await runsHandler(req as any, res2 as any);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.alreadyRecorded).toBe(true);
      expect(res2.body.runId).toBe('run_api_test_1');
    });

    it('GET /api/leaderboard returns formatted entries and player rank', async () => {
      // Submit 2 runs
      await recordCompletedRun({
        runId: 'run_a',
        playerId: 'usr_a',
        playerName: 'Alice',
        wpm: 85,
        score: 7000,
        accuracy: 98,
        wave: 8,
        wordsCompleted: 35,
        durationSeconds: 90,
      });

      await recordCompletedRun({
        runId: 'run_b',
        playerId: 'usr_b',
        playerName: 'Bob',
        wpm: 65,
        score: 4000,
        accuracy: 95,
        wave: 5,
        wordsCompleted: 20,
        durationSeconds: 80,
      });

      const req = {
        method: 'GET',
        query: { playerId: 'usr_b' },
      };
      const res = createMockResponse();
      await leaderboardHandler(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.entries.length).toBe(2);
      expect(res.body.totalEligible).toBe(2);
      expect(res.body.serverTime).toBeGreaterThan(0);

      // Check structure of each entry
      const topEntry = res.body.entries[0];
      expect(topEntry).toHaveProperty('rank', 1);
      expect(topEntry).toHaveProperty('runId', 'run_a');
      expect(topEntry).toHaveProperty('playerId', 'usr_a');
      expect(topEntry).toHaveProperty('playerName', 'Alice');
      expect(topEntry).toHaveProperty('wpm', 85);
      expect(topEntry).toHaveProperty('score', 7000);
      expect(topEntry).toHaveProperty('accuracy', 98);
      expect(topEntry).toHaveProperty('lastPlayedAt');

      // Check target player rank
      expect(res.body.playerRank).not.toBeNull();
      expect(res.body.playerRank.playerId).toBe('usr_b');
      expect(res.body.playerRank.rank).toBe(2);
    });
  });
});
