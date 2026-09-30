// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizePlayerName,
  upsertPlayer,
  recordCompletedRun,
  getWeeklyLeaderboard,
  resetInMemoryDatabase,
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

  describe('Player Name Sanitization & Validation', () => {
    it('sanitizes player names by stripping HTML and control characters', () => {
      expect(sanitizePlayerName('<b>Nisar</b>')).toBe('Nisar');
      expect(sanitizePlayerName('Pilot\x00\x1F')).toBe('Pilot');
      expect(sanitizePlayerName('   Commander Shephard   ')).toBe('Commander Shephard');
    });

    it('rejects names with less than 2 characters or greater than 24 characters', async () => {
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

    it('prevents duplicate run insertion using runId (idempotent submission)', async () => {
      const run = {
        runId: 'run_unique_100',
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

      // Leaderboard should have only 1 entry, not duplicate
      const lb = await getWeeklyLeaderboard();
      expect(lb.entries.length).toBe(1);
    });
  });

  describe('Weekly Leaderboard Ranking Rules', () => {
    it('ranks higher WPM first regardless of score', async () => {
      await recordCompletedRun({
        runId: 'r1',
        playerId: 'p1',
        playerName: 'Player1',
        wpm: 60,
        score: 10000,
        accuracy: 90,
      });

      await recordCompletedRun({
        runId: 'r2',
        playerId: 'p2',
        playerName: 'Player2',
        wpm: 75,
        score: 3000,
        accuracy: 85,
      });

      const lb = await getWeeklyLeaderboard();
      expect(lb.entries[0].playerName).toBe('Player2');
      expect(lb.entries[0].wpm).toBe(75);
      expect(lb.entries[1].playerName).toBe('Player1');
      expect(lb.entries[1].wpm).toBe(60);
    });

    it('breaks WPM ties using higher score first', async () => {
      await recordCompletedRun({
        runId: 'r1',
        playerId: 'p1',
        playerName: 'LowerScore',
        wpm: 80,
        score: 4000,
        accuracy: 95,
      });

      await recordCompletedRun({
        runId: 'r2',
        playerId: 'p2',
        playerName: 'HigherScore',
        wpm: 80,
        score: 6500,
        accuracy: 90,
      });

      const lb = await getWeeklyLeaderboard();
      expect(lb.entries[0].playerName).toBe('HigherScore');
      expect(lb.entries[1].playerName).toBe('LowerScore');
    });

    it('breaks WPM and score ties using higher accuracy first', async () => {
      await recordCompletedRun({
        runId: 'r1',
        playerId: 'p1',
        playerName: 'Acc90',
        wpm: 80,
        score: 5000,
        accuracy: 90,
      });

      await recordCompletedRun({
        runId: 'r2',
        playerId: 'p2',
        playerName: 'Acc98',
        wpm: 80,
        score: 5000,
        accuracy: 98,
      });

      const lb = await getWeeklyLeaderboard();
      expect(lb.entries[0].playerName).toBe('Acc98');
      expect(lb.entries[1].playerName).toBe('Acc90');
    });

    it('breaks WPM, score, and accuracy ties with earlier completed run first', () => {
      const earlier = { wpm: 80, score: 5000, accuracy: 95, completedAt: 1000 };
      const later = { wpm: 80, score: 5000, accuracy: 95, completedAt: 2000 };

      expect(compareRuns(earlier, later)).toBeLessThan(0);
      expect(compareRuns(later, earlier)).toBeGreaterThan(0);
    });

    it('displays only ONE best run per player on the weekly leaderboard', async () => {
      // Nisar plays game 1: 50 WPM
      await recordCompletedRun({
        runId: 'nisar_1',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 50,
        score: 3000,
        accuracy: 95,
      });

      // Nisar plays game 2: 70 WPM (better WPM)
      await recordCompletedRun({
        runId: 'nisar_2',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 70,
        score: 4500,
        accuracy: 97,
      });

      // Another player
      await recordCompletedRun({
        runId: 'sarah_1',
        playerId: 'usr_sarah',
        playerName: 'Sarah',
        wpm: 60,
        score: 5000,
        accuracy: 96,
      });

      const lb = await getWeeklyLeaderboard('usr_nisar');
      expect(lb.entries.length).toBe(2);
      expect(lb.entries[0].playerName).toBe('Nisar');
      expect(lb.entries[0].wpm).toBe(70);
      expect(lb.entries[0].rank).toBe(1);
      expect(lb.playerRank?.rank).toBe(1);

      // Now Nisar plays game 3: equal WPM (70) but higher score (6000)
      await recordCompletedRun({
        runId: 'nisar_3',
        playerId: 'usr_nisar',
        playerName: 'Nisar',
        wpm: 70,
        score: 6000,
        accuracy: 97,
      });

      const lbAfter = await getWeeklyLeaderboard('usr_nisar');
      expect(lbAfter.entries.length).toBe(2);
      expect(lbAfter.entries[0].runId).toBe('nisar_3');
      expect(lbAfter.entries[0].score).toBe(6000);
    });

    it('enforces rolling 7-day window and filters out older runs', async () => {
      // Modern run (today)
      await recordCompletedRun({
        runId: 'recent_1',
        playerId: 'p_recent',
        playerName: 'RecentPlayer',
        wpm: 65,
        score: 4000,
        accuracy: 95,
      });

      const lb = await getWeeklyLeaderboard();
      expect(lb.entries.length).toBe(1);
      expect(lb.entries[0].runId).toBe('recent_1');
    });
  });

  describe('Vercel Serverless Function Endpoints', () => {
    it('GET /api/health returns status ok and service name', async () => {
      const req = { method: 'GET' };
      const res = createMockResponse();

      await healthHandler(req as any, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
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
      expect(topEntry).toHaveProperty('wave', 8);
      expect(topEntry).toHaveProperty('wordsCompleted', 35);
      expect(topEntry).toHaveProperty('durationSeconds', 90);
      expect(topEntry).toHaveProperty('completedAt');

      // Check target player rank
      expect(res.body.playerRank).not.toBeNull();
      expect(res.body.playerRank.playerId).toBe('usr_b');
      expect(res.body.playerRank.rank).toBe(2);
    });
  });
});
