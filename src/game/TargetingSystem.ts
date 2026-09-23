// Targeting & typing lock-on engine for SkillType

import { Enemy, PlayerShip } from './types';

export interface ProcessKeyResult {
  status: 'hit' | 'miss' | 'word_complete' | 'ignored';
  targetEnemy: Enemy | null;
  expectedChar?: string;
  typedChar?: string;
  charScoreAwarded?: number;
  wordScoreAwarded?: number;
}

export class TargetingSystem {
  private currentTarget: Enemy | null = null;

  public getCurrentTarget(): Enemy | null {
    return this.currentTarget;
  }

  public clearTarget(): void {
    if (this.currentTarget) {
      this.currentTarget.isTargeted = false;
      this.currentTarget = null;
    }
  }

  public setTarget(enemy: Enemy): void {
    if (this.currentTarget) {
      this.currentTarget.isTargeted = false;
    }
    this.currentTarget = enemy;
    this.currentTarget.isTargeted = true;
  }

  /**
   * Finds the closest enemy whose word starts with `char`.
   * Distance is measured to the player's coordinate.
   */
  public findClosestEnemyStartingWith(
    char: string,
    activeEnemies: Enemy[],
    player: PlayerShip
  ): Enemy | null {
    const lowerChar = char.toLowerCase();
    const candidates = activeEnemies.filter(
      (e) => !e.isDead && e.word.length > 0 && e.word[0].toLowerCase() === lowerChar
    );

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Find the candidate closest to the player's position
    let closestEnemy: Enemy | null = null;
    let minDistanceSq = Infinity;

    for (const enemy of candidates) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestEnemy = enemy;
      }
    }

    return closestEnemy;
  }

  /**
   * Processes an incoming key stroke.
   * Handles target acquisition, character advancement, errors, and word completion.
   */
  public processKey(
    key: string,
    activeEnemies: Enemy[],
    player: PlayerShip,
    currentMultiplier: number
  ): ProcessKeyResult {
    // Sanity check: must be a single character a-z
    if (key.length !== 1) {
      return { status: 'ignored', targetEnemy: this.currentTarget };
    }

    const lowerKey = key.toLowerCase();
    if (lowerKey < 'a' || lowerKey > 'z') {
      return { status: 'ignored', targetEnemy: this.currentTarget };
    }

    // 1. If NO target is currently locked:
    if (!this.currentTarget || this.currentTarget.isDead) {
      const matchedEnemy = this.findClosestEnemyStartingWith(lowerKey, activeEnemies, player);
      if (!matchedEnemy) {
        return {
          status: 'miss',
          targetEnemy: null,
          typedChar: lowerKey
        };
      }

      // Lock on to matched enemy
      this.setTarget(matchedEnemy);
      matchedEnemy.typedIndex = 1;

      // Base 10 points per character * current multiplier
      const charScore = 10 * currentMultiplier;

      // Check if 1-letter word completed (rare, but supported safely)
      if (matchedEnemy.typedIndex >= matchedEnemy.word.length) {
        const wordBonus = 50 * currentMultiplier;
        const finished = matchedEnemy;
        this.clearTarget();
        return {
          status: 'word_complete',
          targetEnemy: finished,
          typedChar: lowerKey,
          charScoreAwarded: charScore,
          wordScoreAwarded: wordBonus
        };
      }

      return {
        status: 'hit',
        targetEnemy: matchedEnemy,
        typedChar: lowerKey,
        charScoreAwarded: charScore
      };
    }

    // 2. If a target IS locked:
    const target = this.currentTarget;
    const expectedChar = target.word[target.typedIndex]?.toLowerCase();

    if (lowerKey === expectedChar) {
      // Correct letter
      target.typedIndex++;
      const charScore = 10 * currentMultiplier;

      // Check if word completed
      if (target.typedIndex >= target.word.length) {
        const wordBonus = 50 * currentMultiplier;
        const finishedEnemy = target;
        this.clearTarget();
        return {
          status: 'word_complete',
          targetEnemy: finishedEnemy,
          typedChar: lowerKey,
          expectedChar,
          charScoreAwarded: charScore,
          wordScoreAwarded: wordBonus
        };
      }

      return {
        status: 'hit',
        targetEnemy: target,
        typedChar: lowerKey,
        expectedChar,
        charScoreAwarded: charScore
      };
    } else {
      // Incorrect letter for locked word
      return {
        status: 'miss',
        targetEnemy: target,
        typedChar: lowerKey,
        expectedChar
      };
    }
  }

  /**
   * Ensures the target reference remains valid if enemies are removed by pulse, life lost, etc.
   */
  public validateTarget(activeEnemies: Enemy[]): void {
    if (!this.currentTarget) return;
    const exists = activeEnemies.some((e) => e.id === this.currentTarget?.id && !e.isDead);
    if (!exists) {
      this.clearTarget();
    }
  }
}
