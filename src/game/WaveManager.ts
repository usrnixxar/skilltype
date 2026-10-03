// Wave generation, enemy scheduling, and wave progression for SkillType

import { EnemyType, WaveConfig } from './types';
import { Difficulty } from '../utils/storage';

/**
 * Target WPM mapping per level / wave:
 * Wave 1 = 25 WPM (starting baseline)
 * Wave 2 = 28 WPM
 * Wave 3 = 30 WPM
 * Wave 4 = 33 WPM
 * Wave 5 = 35 WPM
 * Followed by smooth progression up to Level 15 (70 WPM).
 */
export function getTargetWPM(level: number): number {
  const wpmByLevel = [
    25, // Level 1 (25 WPM baseline)
    28, // Level 2
    30, // Level 3
    33, // Level 4
    35, // Level 5
    38, // Level 6
    42, // Level 7
    46, // Level 8
    50, // Level 9
    54, // Level 10
    58, // Level 11
    62, // Level 12
    65, // Level 13
    68, // Level 14
    70  // Level 15 (max difficulty)
  ];

  const safeLevel = Math.min(Math.max(level, 1), 15);
  return wpmByLevel[safeLevel - 1];
}

export class WaveManager {
  private currentWave = 1;
  private spawnQueue: EnemyType[] = [];
  private timeUntilNextSpawnMs = 0;
  private spawnIntervalMs = Math.round(60000 / getTargetWPM(1));
  private isWaveInProgress = false;
  private isBetweenWaves = false;
  private waveTransitionTimeRemainingMs = 0;

  public getCurrentWave(): number {
    return this.currentWave;
  }

  public getIsBetweenWaves(): boolean {
    return this.isBetweenWaves;
  }

  public getWaveTransitionRemainingSeconds(): number {
    return Math.max(0, Math.ceil(this.waveTransitionTimeRemainingMs / 1000));
  }

  public getSpawnIntervalMs(): number {
    return this.spawnIntervalMs;
  }

  public getTargetWPM(wave: number = this.currentWave): number {
    return getTargetWPM(wave);
  }

  public reset(startingWave = 1): void {
    this.currentWave = startingWave;
    this.isWaveInProgress = false;
    this.isBetweenWaves = false;
    this.waveTransitionTimeRemainingMs = 0;
    this.spawnQueue = [];
    this.spawnIntervalMs = Math.round(60000 / getTargetWPM(startingWave));
    this.timeUntilNextSpawnMs = 0;
  }

  /**
   * Generates enemy lineup for the given wave and difficulty.
   */
  public generateWaveConfig(wave: number, difficulty: Difficulty): WaveConfig {
    let diffMult = 1.0;
    if (difficulty === 'beginner') diffMult = 0.8;
    if (difficulty === 'expert') diffMult = 1.3;

    // Enemy count scales with wave
    const totalEnemies = Math.min(30, Math.floor((4 + wave * 2) * diffMult));

    // Spawn interval dynamically calculated from level target WPM (25 WPM at L1 to 70 WPM at L15)
    const targetWpm = getTargetWPM(wave);
    const spawnIntervalMs = Math.round(60000 / targetWpm);

    // Enemy type distribution
    let scoutCount = totalEnemies;
    let fighterCount = 0;
    let heavyCount = 0;

    if (wave >= 2) {
      fighterCount = Math.floor(totalEnemies * Math.min(0.45, 0.2 + wave * 0.05));
      scoutCount -= fighterCount;
    }

    if (wave >= 4) {
      heavyCount = Math.floor(totalEnemies * Math.min(0.25, 0.1 + (wave - 3) * 0.04));
      scoutCount -= heavyCount;
      if (scoutCount < 1) scoutCount = 1;
    }

    // Smooth speed scaling synchronized with target WPM (Wave 1 at 25 WPM has 1.0 base speed)
    const speedMultiplier = targetWpm / 25;

    return {
      waveNumber: wave,
      totalEnemies,
      spawnIntervalMs,
      targetWpm,
      speedMultiplier,
      scoutCount,
      fighterCount,
      heavyCount
    };
  }

  /**
   * Starts a new wave with the generated queue.
   */
  public startWave(difficulty: Difficulty): WaveConfig {
    const config = this.generateWaveConfig(this.currentWave, difficulty);

    // Build randomized spawn queue
    const queue: EnemyType[] = [];
    for (let i = 0; i < config.scoutCount; i++) queue.push('scout');
    for (let i = 0; i < config.fighterCount; i++) queue.push('fighter');
    for (let i = 0; i < config.heavyCount; i++) queue.push('heavy');

    // Shuffle queue, but ensure wave 1 and early waves always start with a scout
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    // Guarantee the first enemy is a scout for approachability
    const firstScoutIndex = queue.indexOf('scout');
    if (firstScoutIndex > 0) {
      [queue[0], queue[firstScoutIndex]] = [queue[firstScoutIndex], queue[0]];
    }

    this.spawnQueue = queue;
    this.spawnIntervalMs = config.spawnIntervalMs;
    this.timeUntilNextSpawnMs = 800; // Small delay before first spawn
    this.isWaveInProgress = true;
    this.isBetweenWaves = false;

    return config;
  }

  /**
   * Checks if an enemy is ready to spawn.
   * Returns next EnemyType if ready, null otherwise.
   */
  public tickSpawn(dtMs: number): EnemyType | null {
    if (!this.isWaveInProgress || this.spawnQueue.length === 0) {
      return null;
    }

    this.timeUntilNextSpawnMs -= dtMs;
    if (this.timeUntilNextSpawnMs <= 0) {
      this.timeUntilNextSpawnMs = this.spawnIntervalMs;
      return this.spawnQueue.shift() || null;
    }

    return null;
  }

  /**
   * Checks whether the current wave is complete.
   * A wave completes ONLY when all queued enemies have spawned AND no enemies remain active.
   */
  public checkWaveCompletion(activeEnemyCount: number): boolean {
    if (this.isWaveInProgress && this.spawnQueue.length === 0 && activeEnemyCount === 0) {
      this.isWaveInProgress = false;
      this.isBetweenWaves = true;
      this.waveTransitionTimeRemainingMs = 2400; // 2.4s victory transition
      // Immediately update spawn interval for the next level upon wave clear
      const nextWave = this.currentWave + 1;
      this.spawnIntervalMs = Math.round(60000 / getTargetWPM(nextWave));
      return true;
    }
    return false;
  }

  /**
   * Updates transition countdown between waves.
   * Returns true when countdown finishes and next wave should begin.
   */
  public updateTransition(dtMs: number): boolean {
    if (!this.isBetweenWaves) return false;

    this.waveTransitionTimeRemainingMs -= dtMs;
    if (this.waveTransitionTimeRemainingMs <= 0) {
      this.isBetweenWaves = false;
      this.currentWave++;
      return true;
    }

    return false;
  }

  public getRemainingQueueCount(): number {
    return this.spawnQueue.length;
  }
}
