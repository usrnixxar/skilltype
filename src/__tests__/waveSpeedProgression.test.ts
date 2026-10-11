import { describe, it, expect } from 'vitest';
import { WaveManager, getTargetWPM } from '../game/WaveManager';

describe('20-wave speed progression', () => {
  it('starts at 20 WPM, reaches 70 at wave 20 and caps later waves', () => {
    expect(getTargetWPM(1)).toBe(20);
    expect(getTargetWPM(0)).toBe(20);
    expect(getTargetWPM(20)).toBe(70);
    expect(getTargetWPM(21)).toBe(70);
    expect(getTargetWPM(99)).toBe(70);
    expect(new WaveManager().getSpawnIntervalMs()).toBe(3000);
  });
  it('increases by 2 or 3 WPM each wave and shortens spawn delays', () => {
    const manager = new WaveManager();
    let previous = manager.generateWaveConfig(1, 'normal');
    for (let wave = 2; wave <= 20; wave++) {
      const next = manager.generateWaveConfig(wave, 'normal');
      expect(next.targetWpm! - previous.targetWpm!).toBeGreaterThanOrEqual(2);
      expect(next.targetWpm! - previous.targetWpm!).toBeLessThanOrEqual(3);
      expect(next.spawnIntervalMs).toBeLessThan(previous.spawnIntervalMs);
      expect(next.speedMultiplier).toBeGreaterThan(previous.speedMultiplier);
      previous = next;
    }
    expect(previous.spawnIntervalMs).toBe(857);
  });
  it('actually clears and transitions through all 20 waves', () => {
    const manager = new WaveManager();
    for (let wave = 1; wave <= 20; wave++) {
      expect(manager.getCurrentWave()).toBe(wave);
      const config = manager.startWave('normal');
      expect(config.targetWpm).toBe(getTargetWPM(wave));
      expect(config.spawnIntervalMs).toBe(Math.round(60000 / getTargetWPM(wave)));
      while (manager.tickSpawn(10000) !== null) {}
      expect(manager.checkWaveCompletion(1)).toBe(false);
      expect(manager.checkWaveCompletion(0)).toBe(true);
      if (wave < 20) {
        expect(manager.getSpawnIntervalMs()).toBe(Math.round(60000 / getTargetWPM(wave + 1)));
        expect(manager.updateTransition(2500)).toBe(true);
      }
    }
    expect(manager.getCurrentWave()).toBe(20);
    expect(manager.getTargetWPM()).toBe(70);
  });
});
