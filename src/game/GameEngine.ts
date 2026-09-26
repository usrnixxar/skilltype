// Master Game Engine for SkillType
// Controls game loop, physics, input dispatch, rendering, and stats.

import {
  Enemy,
  GameConfiguration,
  GameStats,
  Laser,
  PlayerShip
} from './types';
import { TargetingSystem } from './TargetingSystem';
import { EnemyManager } from './EnemyManager';
import { WaveManager } from './WaveManager';
import { ParticleSystem } from './ParticleSystem';
import { Starfield } from './Starfield';
import { soundEngine } from '../audio/SoundEngine';
import { ALL_CATEGORIES, categorizeCustomWords, CategoryData } from '../data/wordLists';

export type GameEngineState =
  | 'idle'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'wave_transition'
  | 'game_over'
  | 'practice_finished';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: GameStats) => void;
  onStateChange: (state: GameEngineState) => void;
  onWaveComplete: (wave: number, bonusScore: number) => void;
  onGameOver: (stats: GameStats) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameEngineCallbacks;

  // Subsystems
  private targeting: TargetingSystem;
  private enemyManager: EnemyManager;
  private waveManager: WaveManager;
  private particleSystem: ParticleSystem;
  private starfield: Starfield;

  // Configuration
  private config: GameConfiguration;
  private activeCategoryData: CategoryData;

  // State
  private state: GameEngineState = 'idle';
  private stats: GameStats;
  private player: PlayerShip;
  private lasers: Laser[] = [];

  // Timing
  private lastTimestamp = 0;
  private animationFrameId: number | null = null;
  private countdownValue = 3;
  private countdownTimeRemainingMs = 0;
  private practiceTimeRemainingMs = 0;

  // Screen shake
  private screenShakeIntensity = 0;
  private screenShakeDuration = 0;

  // Dimensions
  private width = 600;
  private height = 800;
  private dangerLineY = 700;

  constructor(
    canvas: HTMLCanvasElement,
    config: GameConfiguration,
    callbacks: GameEngineCallbacks
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
    this.callbacks = callbacks;
    this.config = config;

    this.targeting = new TargetingSystem();
    this.enemyManager = new EnemyManager();
    this.waveManager = new WaveManager();
    this.particleSystem = new ParticleSystem();
    this.starfield = new Starfield();

    this.activeCategoryData = this.resolveCategoryData(config);

    this.player = {
      x: this.width / 2,
      y: this.height - 55,
      angle: 0,
      targetAngle: 0,
      width: 32,
      height: 38,
      thrusterFlame: 0
    };

    this.stats = this.createInitialStats();
    this.resize();
  }

  private createInitialStats(): GameStats {
    return {
      score: 0,
      wave: 1,
      lives: 3,
      maxLives: 3,
      pulsesRemaining: 3,
      maxPulses: 3,
      comboStreak: 0,
      bestCombo: 0,
      multiplier: 1,
      correctKeystrokes: 0,
      incorrectKeystrokes: 0,
      wordsCompleted: 0,
      activePlayTimeMs: 0,
      mistypedLetters: {}
    };
  }

  private resolveCategoryData(config: GameConfiguration): CategoryData {
    if (config.category === 'custom') {
      const buckets = categorizeCustomWords(config.customWords);
      return {
        id: 'custom',
        name: 'Custom Words',
        description: 'User-provided custom vocabulary',
        short: buckets.short,
        medium: buckets.medium,
        long: buckets.long
      };
    }
    return ALL_CATEGORIES[config.category] || ALL_CATEGORIES.common;
  }

  public updateConfig(newConfig: Partial<GameConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.category || newConfig.customWords) {
      this.activeCategoryData = this.resolveCategoryData(this.config);
    }
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.width = Math.max(320, rect.width);
    this.height = Math.max(480, rect.height);
    this.dangerLineY = this.height - 85;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.player.x = this.width / 2;
    this.player.y = this.height - 50;

    this.starfield.resize(this.width, this.height);
  }

  // --- Game Lifecycle ---

  public startGame(): void {
    this.reset();
    this.startCountdown(3);
    soundEngine.startMusic();
  }

  public reset(): void {
    this.targeting.clearTarget();
    this.enemyManager.clear();
    this.waveManager.reset();
    this.particleSystem.clear();
    this.lasers = [];
    this.stats = this.createInitialStats();
    this.screenShakeIntensity = 0;

    if (this.config.mode === 'practice' && this.config.practiceTimedMinutes > 0) {
      this.practiceTimeRemainingMs = this.config.practiceTimedMinutes * 60 * 1000;
    } else {
      this.practiceTimeRemainingMs = 0;
    }

    this.player.x = this.width / 2;
    this.player.y = this.height - 50;
    this.player.angle = 0;
    this.player.targetAngle = 0;

    this.callbacks.onStatsUpdate(this.stats);
  }

  public startCountdown(from = 3): void {
    this.countdownValue = from;
    this.countdownTimeRemainingMs = 1000;
    this.setState('countdown');
  }

  public pause(): void {
    if (this.state === 'playing' || this.state === 'wave_transition') {
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.startCountdown(3);
    }
  }

  public endPractice(): void {
    if (this.config.mode === 'practice') {
      this.setState('practice_finished');
      soundEngine.playWaveComplete();
      this.callbacks.onGameOver(this.stats);
    }
  }

  private setState(newState: GameEngineState): void {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  public getState(): GameEngineState {
    return this.state;
  }

  public getStats(): GameStats {
    return { ...this.stats };
  }

  public getCountdownValue(): number {
    return this.countdownValue;
  }

  public getPracticeTimeRemainingMs(): number {
    return this.practiceTimeRemainingMs;
  }

  // --- Player Input Handling ---

  public handleKeyDown(event: KeyboardEvent): void {
    // 1. Modifiers & repeating keydowns
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // 2. Control Keys: Pause & Pulse
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.state === 'playing') {
        this.pause();
      } else if (this.state === 'paused') {
        this.resume();
      }
      return;
    }

    if (event.key === ' ') {
      // Space bar triggers Emergency Pulse if playing
      if (this.state === 'playing') {
        event.preventDefault();
        this.triggerEmergencyPulse();
      }
      return;
    }

    // 3. Prevent backspace navigation
    if (event.key === 'Backspace') {
      event.preventDefault();
      return;
    }

    // 4. Typing keystrokes during active gameplay
    if (this.state !== 'playing') {
      return;
    }

    this.processTypingCharacter(event.key);
  }

  public processTypingCharacter(rawChar: string): void {
    if (this.state !== 'playing') return;

    const enemies = this.enemyManager.getEnemies();
    const result = this.targeting.processKey(
      rawChar,
      enemies,
      this.player,
      this.stats.multiplier
    );

    if (result.status === 'ignored') return;

    if (result.status === 'hit' && result.targetEnemy) {
      // Correct keystroke
      this.stats.correctKeystrokes++;
      if (result.charScoreAwarded) {
        this.stats.score += result.charScoreAwarded;
      }

      // Fire visual laser and spark particles
      this.fireLaser(result.targetEnemy);
      this.particleSystem.spawnHitSparks(
        result.targetEnemy.x,
        result.targetEnemy.y,
        '#00f0ff',
        this.config.reducedMotion
      );

      soundEngine.playKeyHit();
      soundEngine.playLaser();

    } else if (result.status === 'word_complete' && result.targetEnemy) {
      // Word successfully finished!
      this.stats.correctKeystrokes++;
      this.stats.wordsCompleted++;
      if (result.charScoreAwarded) this.stats.score += result.charScoreAwarded;
      if (result.wordScoreAwarded) this.stats.score += result.wordScoreAwarded;

      // Increment combo streak
      this.stats.comboStreak++;
      if (this.stats.comboStreak > this.stats.bestCombo) {
        this.stats.bestCombo = this.stats.comboStreak;
      }

      // Multiplier updates for NEXT word:
      // x1 initially, x2 after 5 clean words, x3 after 10, x4 after 20
      if (this.stats.comboStreak >= 20) {
        this.stats.multiplier = 4;
      } else if (this.stats.comboStreak >= 10) {
        this.stats.multiplier = 3;
      } else if (this.stats.comboStreak >= 5) {
        this.stats.multiplier = 2;
      } else {
        this.stats.multiplier = 1;
      }

      // Fire final laser & destroy enemy
      this.fireLaser(result.targetEnemy);
      result.targetEnemy.isDead = true;

      const intensity =
        result.targetEnemy.type === 'heavy'
          ? 'large'
          : result.targetEnemy.type === 'fighter'
          ? 'medium'
          : 'small';

      this.particleSystem.spawnExplosion(
        result.targetEnemy.x,
        result.targetEnemy.y,
        result.targetEnemy.color,
        intensity,
        this.config.reducedMotion
      );

      soundEngine.playExplosion(intensity);

      // Light screen shake on heavy kill
      if (result.targetEnemy.type === 'heavy' && !this.config.reducedMotion) {
        this.triggerScreenShake(6, 0.2);
      }

    } else if (result.status === 'miss') {
      // Incorrect keystroke
      this.stats.incorrectKeystrokes++;
      this.stats.comboStreak = 0;
      this.stats.multiplier = 1; // Reset multiplier on error

      // Log mistyped expected letter for statistics breakdown
      if (result.expectedChar) {
        const charKey = result.expectedChar.toUpperCase();
        this.stats.mistypedLetters[charKey] =
          (this.stats.mistypedLetters[charKey] || 0) + 1;
      }

      soundEngine.playError();
    }

    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  /**
   * Fires an emergency pulse clearing all active enemies.
   */
  public triggerEmergencyPulse(): void {
    if (this.stats.pulsesRemaining <= 0 || this.state !== 'playing') return;

    this.stats.pulsesRemaining--;
    this.stats.comboStreak = 0;
    this.stats.multiplier = 1;

    // Clear active enemies without awarding typing points
    const activeEnemies = this.enemyManager.getEnemies();
    for (const enemy of activeEnemies) {
      enemy.isDead = true;
      this.particleSystem.spawnExplosion(
        enemy.x,
        enemy.y,
        enemy.color,
        'medium',
        this.config.reducedMotion
      );
    }

    this.targeting.clearTarget();
    this.particleSystem.spawnPulseShockwave(this.player.x, this.player.y, this.height);
    soundEngine.playPulse();

    if (!this.config.reducedMotion) {
      this.triggerScreenShake(12, 0.4);
    }

    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private fireLaser(target: Enemy): void {
    // Cannon tip offset
    const cannonLen = 22;
    const startX = this.player.x + Math.sin(this.player.angle) * cannonLen;
    const startY = this.player.y - Math.cos(this.player.angle) * cannonLen;

    this.lasers.push({
      id: `laser_${Date.now()}_${Math.random()}`,
      startX,
      startY,
      targetX: target.x,
      targetY: target.y,
      x: startX,
      y: startY,
      color: '#00f0ff',
      progress: 0,
      speed: 12.0 // fast laser visual
    });
  }

  private triggerScreenShake(intensity: number, durationSeconds: number): void {
    if (this.config.reducedMotion) return;
    this.screenShakeIntensity = intensity;
    this.screenShakeDuration = durationSeconds;
  }

  // --- Main Animation Loop ---

  public startLoop(): void {
    if (this.animationFrameId !== null) return;
    this.lastTimestamp = performance.now();
    const loop = (timestamp: number) => {
      const dtMs = Math.min(100, timestamp - this.lastTimestamp);
      const dt = dtMs / 1000;
      this.lastTimestamp = timestamp;

      this.update(dt, dtMs, timestamp);
      this.render(timestamp);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // --- Engine Update ---

  private update(dt: number, dtMs: number, currentTimeMs: number): void {
    // 1. Starfield always scrolls
    this.starfield.update(dt, this.width, this.height, this.config.reducedMotion);

    // 2. Countdown State
    if (this.state === 'countdown') {
      this.countdownTimeRemainingMs -= dtMs;
      if (this.countdownTimeRemainingMs <= 0) {
        this.countdownValue--;
        if (this.countdownValue <= 0) {
          this.setState('playing');
          if (!this.waveManager.getIsBetweenWaves() && this.enemyManager.getEnemies().length === 0) {
            this.waveManager.startWave(this.config.difficulty);
          }
        } else {
          this.countdownTimeRemainingMs = 1000;
        }
      }
      return;
    }

    // 3. Paused / Finished states don't advance game physics
    if (this.state === 'paused' || this.state === 'game_over' || this.state === 'practice_finished') {
      return;
    }

    // 4. Playing State: Advance Active Playing Time
    if (this.state === 'playing') {
      this.stats.activePlayTimeMs += dtMs;

      // Practice Timed countdown check
      if (this.config.mode === 'practice' && this.practiceTimeRemainingMs > 0) {
        this.practiceTimeRemainingMs -= dtMs;
        if (this.practiceTimeRemainingMs <= 0) {
          this.practiceTimeRemainingMs = 0;
          this.endPractice();
          return;
        }
      }
    }

    // 5. Update Screen Shake
    if (this.screenShakeDuration > 0) {
      this.screenShakeDuration -= dt;
      if (this.screenShakeDuration <= 0) {
        this.screenShakeIntensity = 0;
      }
    }

    // 6. Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.progress += laser.speed * dt;
      laser.x = laser.startX + (laser.targetX - laser.startX) * laser.progress;
      laser.y = laser.startY + (laser.targetY - laser.startY) * laser.progress;

      if (laser.progress >= 1) {
        this.lasers.splice(i, 1);
      }
    }

    // 7. Update Particles
    this.particleSystem.update(dt);

    // 8. Player Ship Aiming towards target
    const currentTarget = this.targeting.getCurrentTarget();
    if (currentTarget && !currentTarget.isDead) {
      const dx = currentTarget.x - this.player.x;
      const dy = currentTarget.y - this.player.y;
      this.player.targetAngle = Math.atan2(dx, -dy);
    } else {
      this.player.targetAngle = 0; // Return to neutral straight up
    }

    // Smooth angle interpolation
    const angleDiff = this.player.targetAngle - this.player.angle;
    this.player.angle += angleDiff * Math.min(1, 14 * dt);
    this.player.thrusterFlame = 0.8 + Math.sin(currentTimeMs * 0.03) * 0.2;

    // 9. Wave Transition handling
    if (this.state === 'wave_transition') {
      const shouldStartNextWave = this.waveManager.updateTransition(dtMs);
      if (shouldStartNextWave) {
        this.stats.wave = this.waveManager.getCurrentWave();
        this.waveManager.startWave(this.config.difficulty);
        this.setState('playing');
        this.callbacks.onStatsUpdate({ ...this.stats });
      }
      return;
    }

    // 10. Spawn Queued Enemies
    const nextEnemyType = this.waveManager.tickSpawn(dtMs);
    if (nextEnemyType) {
      this.enemyManager.spawnEnemy(
        nextEnemyType,
        this.activeCategoryData,
        this.config.difficulty,
        this.width,
        this.height
      );
    }

    // 11. Update Enemies & Handle Breaches
    const breaches = this.enemyManager.update(dt, this.width, this.dangerLineY);
    if (breaches.length > 0) {
      for (const breachedEnemy of breaches) {
        // Impact explosion at danger line
        this.particleSystem.spawnExplosion(
          breachedEnemy.x,
          this.dangerLineY,
          '#ff0055',
          'large',
          this.config.reducedMotion
        );

        // Reset combo
        this.stats.comboStreak = 0;
        this.stats.multiplier = 1;

        // In practice relaxed mode, lives are not lost
        if (this.config.mode === 'practice' && this.config.practiceRelaxed) {
          soundEngine.playLifeLost();
        } else {
          this.stats.lives = Math.max(0, this.stats.lives - 1);
          soundEngine.playLifeLost();
          if (!this.config.reducedMotion) {
            this.triggerScreenShake(14, 0.4);
          }

          if (this.stats.lives <= 0) {
            this.handleGameOver();
            return;
          }
        }
      }

      this.callbacks.onStatsUpdate({ ...this.stats });
    }

    // 12. Validate Target (clears if target was breached or killed)
    this.targeting.validateTarget(this.enemyManager.getEnemies());

    // 13. Check Wave Completion
    if (this.state === 'playing') {
      const isWaveComplete = this.waveManager.checkWaveCompletion(
        this.enemyManager.getEnemies().length
      );

      if (isWaveComplete) {
        const bonusScore = this.stats.wave * 150;
        this.stats.score += bonusScore;
        this.setState('wave_transition');
        soundEngine.playWaveComplete();
        this.callbacks.onWaveComplete(this.stats.wave, bonusScore);
        this.callbacks.onStatsUpdate({ ...this.stats });
      }
    }
  }

  private handleGameOver(): void {
    this.setState('game_over');
    soundEngine.playGameOver();
    this.callbacks.onGameOver(this.stats);
  }

  // --- Render ---

  private render(timeMs: number): void {
    this.ctx.save();

    // Screen Shake
    if (this.screenShakeIntensity > 0 && !this.config.reducedMotion) {
      const offsetX = (Math.random() - 0.5) * this.screenShakeIntensity;
      const offsetY = (Math.random() - 0.5) * this.screenShakeIntensity;
      this.ctx.translate(offsetX, offsetY);
    }

    // 1. Starfield, Grid & Danger Line
    this.starfield.render(this.ctx, this.width, this.height, this.dangerLineY, timeMs);

    // 2. Lasers
    this.renderLasers();

    // 3. Enemies and Labels
    this.enemyManager.render(this.ctx, timeMs, this.config.reducedMotion);

    // 4. Particles & Shockwaves
    this.particleSystem.render(this.ctx);

    // 5. Player Ship
    this.renderPlayerShip(timeMs);

    // 6. Wave Transition Banner Overlay
    if (this.state === 'wave_transition') {
      this.renderWaveCompleteOverlay();
    }

    // 7. Resume / Start Countdown Overlay
    if (this.state === 'countdown') {
      this.renderCountdownOverlay();
    }

    this.ctx.restore();
  }

  private renderLasers(): void {
    for (const laser of this.lasers) {
      this.ctx.save();
      this.ctx.strokeStyle = laser.color;
      this.ctx.lineWidth = 3;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = laser.color;

      // Glowing plasma bolt
      const trailLen = 28;
      const dx = laser.targetX - laser.startX;
      const dy = laser.targetY - laser.startY;
      const dist = Math.hypot(dx, dy) || 1;
      const normX = dx / dist;
      const normY = dy / dist;

      this.ctx.beginPath();
      this.ctx.moveTo(laser.x - normX * trailLen, laser.y - normY * trailLen);
      this.ctx.lineTo(laser.x, laser.y);
      this.ctx.stroke();

      // Laser bolt head
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(laser.x, laser.y, 3.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }
  }

  private renderPlayerShip(_timeMs: number): void {
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.rotate(this.player.angle);

    if (!this.config.reducedMotion) {
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#00f0ff';
    }

    // Thruster plume
    this.ctx.save();
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.beginPath();
    this.ctx.moveTo(-6, 12);
    this.ctx.lineTo(0, 12 + 18 * this.player.thrusterFlame);
    this.ctx.lineTo(6, 12);
    this.ctx.closePath();
    this.ctx.fill();

    // Inner fiery core
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(-3, 12);
    this.ctx.lineTo(0, 12 + 10 * this.player.thrusterFlame);
    this.ctx.lineTo(3, 12);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    // Spaceship Hull
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.fillStyle = '#091530';
    this.ctx.lineWidth = 2.2;

    this.ctx.beginPath();
    this.ctx.moveTo(0, -22);    // Cannon tip
    this.ctx.lineTo(-18, 14);   // Left wing
    this.ctx.lineTo(-7, 10);    // Inner wing notch
    this.ctx.lineTo(0, 14);     // Center base
    this.ctx.lineTo(7, 10);     // Inner wing notch
    this.ctx.lineTo(18, 14);    // Right wing
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Cockpit Canopy
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -10);
    this.ctx.lineTo(-4, 0);
    this.ctx.lineTo(0, 4);
    this.ctx.lineTo(4, 0);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private renderWaveCompleteOverlay(): void {
    const remainingSec = this.waveManager.getWaveTransitionRemainingSeconds();
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(4, 7, 20, 0.7)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Banner Text
    this.ctx.font = '900 28px system-ui, -apple-system, sans-serif';
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.fillText(`WAVE ${this.stats.wave} CLEARED!`, this.width / 2, this.height / 2 - 25);

    this.ctx.font = '600 15px ui-monospace, "Cascadia Code", monospace';
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.shadowBlur = 0;
    this.ctx.fillText(
      `Next wave incoming in ${remainingSec}s...`,
      this.width / 2,
      this.height / 2 + 20
    );

    this.ctx.restore();
  }

  private renderCountdownOverlay(): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(4, 7, 20, 0.6)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.font = '900 72px system-ui, -apple-system, sans-serif';
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowBlur = 25;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.fillText(`${this.countdownValue}`, this.width / 2, this.height / 2);

    this.ctx.font = '600 16px system-ui, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.shadowBlur = 0;
    this.ctx.fillText('PREPARE TO TYPE', this.width / 2, this.height / 2 + 60);

    this.ctx.restore();
  }

  public destroy(): void {
    this.stopLoop();
    this.targeting.clearTarget();
    this.enemyManager.clear();
    this.particleSystem.clear();
  }
}
