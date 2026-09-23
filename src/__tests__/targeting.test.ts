import { describe, it, expect, beforeEach } from 'vitest';
import { TargetingSystem } from '../game/TargetingSystem';
import { Enemy, PlayerShip } from '../game/types';

describe('TargetingSystem', () => {
  let targeting: TargetingSystem;
  let player: PlayerShip;

  beforeEach(() => {
    targeting = new TargetingSystem();
    player = {
      x: 300,
      y: 750,
      angle: 0,
      targetAngle: 0,
      width: 32,
      height: 38,
      thrusterFlame: 0,
    };
  });

  const createEnemy = (id: string, word: string, x: number, y: number): Enemy => ({
    id,
    word,
    typedIndex: 0,
    type: 'scout',
    x,
    y,
    vx: 0,
    vy: 30,
    width: 26,
    height: 26,
    color: '#00f0ff',
    points: 50,
    isTargeted: false,
    swayPhase: 0,
    swaySpeed: 0,
    swayAmplitude: 0,
    baseX: x,
    isDead: false,
  });

  it('selects the closest enemy when duplicate starting letters exist', () => {
    const farEnemy = createEnemy('e1', 'star', 300, 100);
    const closeEnemy = createEnemy('e2', 'solar', 300, 500);

    const match = targeting.findClosestEnemyStartingWith('s', [farEnemy, closeEnemy], player);
    expect(match).not.toBeNull();
    expect(match?.id).toBe('e2');
  });

  it('locks onto target upon first matching key and advances character', () => {
    const enemy = createEnemy('e1', 'nova', 300, 200);
    const result = targeting.processKey('n', [enemy], player, 1);

    expect(result.status).toBe('hit');
    expect(result.charScoreAwarded).toBe(10);
    expect(enemy.typedIndex).toBe(1);
    expect(targeting.getCurrentTarget()?.id).toBe('e1');
  });

  it('reports miss and does not advance when typing incorrect character for locked target', () => {
    const enemy = createEnemy('e1', 'nova', 300, 200);
    targeting.setTarget(enemy);
    enemy.typedIndex = 1; // 'n' is typed, expects 'o'

    const result = targeting.processKey('x', [enemy], player, 1);
    expect(result.status).toBe('miss');
    expect(result.expectedChar).toBe('o');
    expect(enemy.typedIndex).toBe(1);
  });

  it('completes word and clears target upon finishing all characters', () => {
    const enemy = createEnemy('e1', 'or', 300, 200);
    targeting.setTarget(enemy);
    enemy.typedIndex = 1; // 'o' typed, next is 'r'

    const result = targeting.processKey('r', [enemy], player, 2);
    expect(result.status).toBe('word_complete');
    expect(result.charScoreAwarded).toBe(20); // 10 * 2
    expect(result.wordScoreAwarded).toBe(100); // 50 * 2
    expect(targeting.getCurrentTarget()).toBeNull();
  });

  it('safely validates target when target enemy is removed', () => {
    const enemy = createEnemy('e1', 'warp', 300, 200);
    targeting.setTarget(enemy);
    expect(targeting.getCurrentTarget()).not.toBeNull();

    // Enemy dies/breaches
    enemy.isDead = true;
    targeting.validateTarget([]);
    expect(targeting.getCurrentTarget()).toBeNull();
  });
});
