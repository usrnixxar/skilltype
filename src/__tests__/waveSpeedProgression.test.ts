import { describe, it, expect, beforeEach } from 'vitest';
import { WaveManager, getTargetWPM } from '../game/WaveManager';

describe('Wave Speed Progression and Word Spawning Logic', () => {
  let waveManager: WaveManager;

  beforeEach(() => {
    waveManager = new WaveManager();
  });

  describe('getTargetWPM mapping', () => {
    const expectedWpm = [
      { level: 1, wpm: 30 },
      { level: 2, wpm: 33 },
      { level: 3, wpm: 36 },
      { level: 4, wpm: 39 },
      { level: 5, wpm: 42 },
      { level: 6, wpm: 45 },
      { level: 7, wpm: 48 },
      { level: 8, wpm: 51 },
      { level: 9, wpm: 54 },
      { level: 10, wpm: 57 },
      { level: 11, wpm: 60 },
      { level: 12, wpm: 63 },
      { level: 13, wpm: 65 },
      { level: 14, wpm: 68 },
      { level: 15, wpm: 70 },
    ];

    expectedWpm.forEach(({ level, wpm }) => {
      it(`maps Level ${level} to ${wpm} WPM`, () => {
        expect(getTargetWPM(level)).toBe(wpm);
      });
    });

    it('clamps levels below 1 to Level 1 (30 WPM)', () => {
      expect(getTargetWPM(0)).toBe(30);
      expect(getTargetWPM(-5)).toBe(30);
    });

    it('clamps levels above 15 to Level 15 (70 WPM) to not exceed 70 WPM', () => {
      expect(getTargetWPM(16)).toBe(70);
      expect(getTargetWPM(20)).toBe(70);
      expect(getTargetWPM(99)).toBe(70);
    });
  });

  describe('Spawn Interval Calculations', () => {
    it('calculates the correct spawn interval from target WPM for each level', () => {
      // Level 1: 30 WPM -> 60000 / 30 = 2000 ms
      const config1 = waveManager.generateWaveConfig(1, 'normal');
      expect(config1.spawnIntervalMs).toBe(2000);

      // Level 2: 33 WPM -> 60000 / 33 = 1818 ms
      const config2 = waveManager.generateWaveConfig(2, 'normal');
      expect(config2.spawnIntervalMs).toBe(1818);

      // Level 5: 42 WPM -> 60000 / 42 = 1429 ms
      const config5 = waveManager.generateWaveConfig(5, 'normal');
      expect(config5.spawnIntervalMs).toBe(1429);

      // Level 10: 57 WPM -> 60000 / 57 = 1053 ms
      const config10 = waveManager.generateWaveConfig(10, 'normal');
      expect(config10.spawnIntervalMs).toBe(1053);

      // Level 15: 70 WPM -> 60000 / 70 = 857 ms
      const config15 = waveManager.generateWaveConfig(15, 'normal');
      expect(config15.spawnIntervalMs).toBe(857);
    });

    it('ensures higher levels have strictly shorter delay between word appearances', () => {
      let previousInterval = Infinity;
      for (let level = 1; level <= 15; level++) {
        const config = waveManager.generateWaveConfig(level, 'normal');
        expect(config.spawnIntervalMs).toBeLessThan(previousInterval);
        previousInterval = config.spawnIntervalMs;
      }
    });

    it('confirms Level 15 is noticeably faster (>2.3x) than Level 1', () => {
      const config1 = waveManager.generateWaveConfig(1, 'normal');
      const config15 = waveManager.generateWaveConfig(15, 'normal');

      // 2000 ms vs 857 ms: speed ratio 2000 / 857 = 2.33x
      expect(config1.spawnIntervalMs).toBe(2000);
      expect(config15.spawnIntervalMs).toBe(857);
      expect(config1.spawnIntervalMs / config15.spawnIntervalMs).toBeGreaterThan(2.3);
    });

    it('keeps Level 15 spawn speed beyond Level 15', () => {
      const config15 = waveManager.generateWaveConfig(15, 'normal');
      const config16 = waveManager.generateWaveConfig(16, 'normal');
      const config25 = waveManager.generateWaveConfig(25, 'normal');

      expect(config16.spawnIntervalMs).toBe(config15.spawnIntervalMs);
      expect(config25.spawnIntervalMs).toBe(config15.spawnIntervalMs);
    });
  });

  describe('Wave Progression and Spawn Interval Updates', () => {
    it('initializes Level 1 with 30 WPM spawn interval (2000 ms)', () => {
      expect(waveManager.getCurrentWave()).toBe(1);
      expect(waveManager.getSpawnIntervalMs()).toBe(2000);
    });

    it('immediately updates spawn interval for Level 2 upon clearing Level 1', () => {
      waveManager.startWave('normal');
      // Drain queue to simulate all enemies spawned
      while (waveManager.tickSpawn(10000) !== null) {
        // draining
      }

      // Check wave completion with 0 active enemies
      const completed = waveManager.checkWaveCompletion(0);
      expect(completed).toBe(true);

      // Immediately after clearing Level 1, spawnIntervalMs must update for Level 2 (1818 ms)
      expect(waveManager.getSpawnIntervalMs()).toBe(1818);
    });

    it('transitions to Level 2 and starts wave with faster spawn rate', () => {
      waveManager.startWave('normal');
      while (waveManager.tickSpawn(10000) !== null) {}
      waveManager.checkWaveCompletion(0);

      // Advance through transition countdown (2400 ms)
      const transitionDone = waveManager.updateTransition(2500);
      expect(transitionDone).toBe(true);
      expect(waveManager.getCurrentWave()).toBe(2);

      // Start Level 2
      const config2 = waveManager.startWave('normal');
      expect(config2.waveNumber).toBe(2);
      expect(config2.spawnIntervalMs).toBe(1818);
      expect(waveManager.getSpawnIntervalMs()).toBe(1818);
    });

    it('progressively clears and advances through Levels 5, 10, and 15 with matching speeds', () => {
      // Simulate progressing wave by wave
      for (let wave = 1; wave <= 15; wave++) {
        expect(waveManager.getCurrentWave()).toBe(wave);
        const expectedWpm = getTargetWPM(wave);
        const expectedInterval = Math.round(60000 / expectedWpm);

        const config = waveManager.startWave('normal');
        expect(config.spawnIntervalMs).toBe(expectedInterval);
        expect(waveManager.getSpawnIntervalMs()).toBe(expectedInterval);

        // Drain and clear
        while (waveManager.tickSpawn(10000) !== null) {}
        waveManager.checkWaveCompletion(0);

        if (wave < 15) {
          // Immediately after clear, spawn interval is updated for next wave
          const nextExpectedWpm = getTargetWPM(wave + 1);
          expect(waveManager.getSpawnIntervalMs()).toBe(Math.round(60000 / nextExpectedWpm));

          // Advance transition
          waveManager.updateTransition(2500);
        }
      }

      expect(waveManager.getCurrentWave()).toBe(15);
      expect(waveManager.getTargetWPM()).toBe(70);
      expect(waveManager.getSpawnIntervalMs()).toBe(857);
    });
  });
});
