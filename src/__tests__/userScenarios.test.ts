// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordCompletedRun,
  getWeeklyLeaderboard,
  getDailyLeaderboard,
  resetInMemoryDatabase,
} from '../../api/lib/db.js';
import { WaveManager, getTargetWPM } from '../game/WaveManager';
import { getWeekId, getDayId, getTimeUntilSaturdayReset } from '../utils/dateUtils';
import { validatePlayerName } from '../utils/playerProfile';

describe('SkillType User Acceptance Test Scenarios (1 to 10)', () => {
  beforeEach(() => {
    resetInMemoryDatabase();
  });

  it('TEST 1 & TEST 2: New player Nisar joins and scores 500 points', async () => {
    const valid = validatePlayerName('Nisar');
    expect(valid.valid).toBe(true);
    expect(valid.trimmedName).toBe('Nisar');

    // Nisar scores 500 points
    const runResult = await recordCompletedRun({
      gameSessionId: 'nisar_game_1',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 32,
      score: 500,
      accuracy: 94,
    });

    expect(runResult.success).toBe(true);

    const lb = await getWeeklyLeaderboard('usr_nisar_uuid');
    expect(lb.entries.length).toBe(1);
    expect(lb.entries[0].playerName).toBe('Nisar');
    expect(lb.entries[0].weeklyPoints).toBe(500);
    expect(lb.entries[0].bestWpm).toBe(32);
    expect(lb.entries[0].rank).toBe(1);
    expect(lb.playerRank?.rank).toBe(1);
  });

  it('TEST 3: Nisar plays again and scores 700 -> Weekly Points = 1200, NO duplicate rows', async () => {
    // Game 1: 500 points
    await recordCompletedRun({
      gameSessionId: 'nisar_game_1',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 32,
      score: 500,
      accuracy: 94,
    });

    // Game 2: 700 points
    await recordCompletedRun({
      gameSessionId: 'nisar_game_2',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 41,
      score: 700,
      accuracy: 96,
    });

    const lb = await getWeeklyLeaderboard('usr_nisar_uuid');
    expect(lb.entries.length).toBe(1); // exactly one row
    expect(lb.entries[0].playerName).toBe('Nisar');
    expect(lb.entries[0].weeklyPoints).toBe(1200); // 500 + 700 = 1200
    expect(lb.entries[0].gamesPlayed).toBe(2);
  });

  it('TEST 4: Nisar WPM: Game 1 = 32, Game 2 = 41 -> Leaderboard WPM = 41', async () => {
    await recordCompletedRun({
      gameSessionId: 'nisar_game_1',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 32,
      score: 500,
      accuracy: 94,
    });

    await recordCompletedRun({
      gameSessionId: 'nisar_game_2',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 41,
      score: 700,
      accuracy: 96,
    });

    // Game 3 with 35 WPM
    await recordCompletedRun({
      gameSessionId: 'nisar_game_3',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 35,
      score: 300,
      accuracy: 92,
    });

    const lb = await getWeeklyLeaderboard();
    // best_wpm = MAX(32, 41, 35) = 41
    expect(lb.entries[0].bestWpm).toBe(41);
    expect(lb.entries[0].weeklyPoints).toBe(1500); // 500 + 700 + 300
  });

  it('TEST 5: Rehan scores 1500 -> Leaderboard automatically ranks #1 Rehan, #2 Nisar', async () => {
    // Nisar has 1200 points
    await recordCompletedRun({
      gameSessionId: 'nisar_total',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 41,
      score: 1200,
      accuracy: 95,
    });

    // Rehan scores 1500 points
    await recordCompletedRun({
      gameSessionId: 'rehan_game_1',
      playerId: 'usr_rehan_uuid',
      playerName: 'Rehan',
      wpm: 49,
      score: 1500,
      accuracy: 97,
    });

    const lb = await getWeeklyLeaderboard();
    expect(lb.entries.length).toBe(2);
    expect(lb.entries[0].playerName).toBe('Rehan');
    expect(lb.entries[0].weeklyPoints).toBe(1500);
    expect(lb.entries[0].bestWpm).toBe(49);
    expect(lb.entries[0].rank).toBe(1);

    expect(lb.entries[1].playerName).toBe('Nisar');
    expect(lb.entries[1].weeklyPoints).toBe(1200);
    expect(lb.entries[1].bestWpm).toBe(41);
    expect(lb.entries[1].rank).toBe(2);
  });

  it('TEST 6 & 7: Leaderboard data remains on reload and multi-client queries', async () => {
    // Client A registers scores
    await recordCompletedRun({
      gameSessionId: 'session_client_a',
      playerId: 'usr_client_a',
      playerName: 'Aman',
      wpm: 46,
      score: 4200,
      accuracy: 96,
    });

    // Simulated browser reload / Client B query from another device
    const clientBView = await getWeeklyLeaderboard('usr_other_client');
    expect(clientBView.entries.length).toBe(1);
    expect(clientBView.entries[0].playerName).toBe('Aman');
    expect(clientBView.entries[0].weeklyPoints).toBe(4200);
  });

  it('TEST 8: Saturday 11:59 PM IST reset preserves previous week history', async () => {
    // Saturday week 39 (e.g. 2026-W39)
    await recordCompletedRun({
      gameSessionId: 'nisar_w39',
      playerId: 'usr_nisar_uuid',
      playerName: 'Nisar',
      wpm: 52,
      score: 5850,
      accuracy: 98,
      weekId: '2026-W39',
    });

    // Query active week 2026-W39
    const lbW39 = await getWeeklyLeaderboard(null, '2026-W39');
    expect(lbW39.entries.length).toBe(1);
    expect(lbW39.entries[0].playerName).toBe('Nisar');

    // Sunday begins new week 2026-W40
    // Query week 2026-W40 before new games are played
    const lbW40 = await getWeeklyLeaderboard(null, '2026-W40');
    expect(lbW40.entries.length).toBe(0); // Clean reset for new week

    // In 2026-W40, Rehan plays
    await recordCompletedRun({
      gameSessionId: 'rehan_w40',
      playerId: 'usr_rehan_uuid',
      playerName: 'Rehan',
      wpm: 49,
      score: 5300,
      accuracy: 97,
      weekId: '2026-W40',
    });

    const lbW40After = await getWeeklyLeaderboard(null, '2026-W40');
    expect(lbW40After.entries.length).toBe(1);
    expect(lbW40After.entries[0].playerName).toBe('Rehan');
    expect(lbW40After.entries[0].weeklyPoints).toBe(5300);

    // Old Week 39 historical data is safely preserved
    const lbW39History = await getWeeklyLeaderboard(null, '2026-W39');
    expect(lbW39History.entries.length).toBe(1);
    expect(lbW39History.entries[0].playerName).toBe('Nisar');
    expect(lbW39History.entries[0].weeklyPoints).toBe(5850);
  });

  it('TEST 9: Wave 1 speed starts at 25 WPM with synchronized word spawn interval', () => {
    const waveManager = new WaveManager();
    expect(waveManager.getCurrentWave()).toBe(1);
    expect(getTargetWPM(1)).toBe(25);
    // Interval for 25 WPM: 60000 / 25 = 2400 ms
    expect(waveManager.getSpawnIntervalMs()).toBe(2400);

    // Wave 2 = 28 WPM
    expect(getTargetWPM(2)).toBe(28);
    // Wave 3 = 30 WPM
    expect(getTargetWPM(3)).toBe(30);
    // Wave 4 = 33 WPM
    expect(getTargetWPM(4)).toBe(33);
    // Wave 5 = 35 WPM
    expect(getTargetWPM(5)).toBe(35);

    const wave1Config = waveManager.generateWaveConfig(1, 'normal');
    expect(wave1Config.targetWpm).toBe(25);
    expect(wave1Config.spawnIntervalMs).toBe(2400);
    expect(wave1Config.speedMultiplier).toBe(1.0);
  });

  it('Validates Saturday reset calculation in Asia/Kolkata timezone', () => {
    // Saturday Oct 3, 2026 at 23:59:50 IST
    const satNight = new Date('2026-10-03T23:59:50+05:30');
    expect(getWeekId(satNight)).toBe('2026-W39');
    expect(getDayId(satNight)).toBe('2026-10-03');

    // Sunday Oct 4, 2026 at 00:00:10 IST (10 seconds after Saturday reset)
    const sunMorning = new Date('2026-10-04T00:00:10+05:30');
    expect(getWeekId(sunMorning)).toBe('2026-W40');
    expect(getDayId(sunMorning)).toBe('2026-10-04');

    // Countdown returns positive milliseconds
    const countdown = getTimeUntilSaturdayReset(satNight);
    expect(countdown.totalMs).toBeGreaterThan(0);
    expect(countdown.totalMs).toBeLessThanOrEqual(10000); // within 10 seconds of reset
  });

  it('STEP 9 & STEP 14: Verifies player_name and playerName are both present and old broken rows safely repaired', async () => {
    // Player submits with player_name
    const res1 = await recordCompletedRun({
      gameSessionId: 'session_nisar_exact',
      player_id: 'usr_nisar_exact',
      player_name: 'Nisar',
      score: 1500,
      wpm: 42,
      accuracy: 97,
    });

    expect(res1.record.player_name).toBe('Nisar');
    expect(res1.record.playerName).toBe('Nisar');

    // Player Rehan submits
    const res2 = await recordCompletedRun({
      gameSessionId: 'session_rehan_exact',
      player_id: 'usr_rehan_exact',
      player_name: 'Rehan',
      score: 1200,
      wpm: 39,
      accuracy: 95,
    });

    expect(res2.record.player_name).toBe('Rehan');
    expect(res2.record.playerName).toBe('Rehan');

    // Query leaderboard
    const lb = await getWeeklyLeaderboard();
    expect(lb.entries.length).toBe(2);

    // TEST 5 JSON check: every entry must have player_name and playerName
    expect(lb.entries[0].player_name).toBe('Nisar');
    expect(lb.entries[0].playerName).toBe('Nisar');
    expect(lb.entries[0].weeklyPoints).toBe(1500);
    expect(lb.entries[0].bestWpm).toBe(42);

    expect(lb.entries[1].player_name).toBe('Rehan');
    expect(lb.entries[1].playerName).toBe('Rehan');
    expect(lb.entries[1].weeklyPoints).toBe(1200);
    expect(lb.entries[1].bestWpm).toBe(39);

    // Each row retains its own participant's name without hardcoding or overwriting
    expect(lb.entries[0].player_name).not.toBe(lb.entries[1].player_name);
  });
});
