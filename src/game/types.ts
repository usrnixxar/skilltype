// Core data types and interfaces for SkillType game engine

import { Difficulty, GameMode } from '../utils/storage';
import { WordCategory } from '../data/wordLists';

export type EnemyType = 'scout' | 'fighter' | 'heavy';

export interface Enemy {
  id: string;
  word: string;
  typedIndex: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  points: number;
  isTargeted: boolean;
  swayPhase: number;
  swaySpeed: number;
  swayAmplitude: number;
  baseX: number;
  isDead: boolean;
}

export interface Laser {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  color: string;
  progress: number; // 0 to 1
  speed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'smoke' | 'ring' | 'shockwave';
  radius?: number;
  maxRadius?: number;
}

export interface PlayerShip {
  x: number;
  y: number;
  angle: number; // In radians, points towards targeted enemy
  targetAngle: number;
  width: number;
  height: number;
  thrusterFlame: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export interface GameStats {
  score: number;
  wave: number;
  lives: number;
  maxLives: number;
  pulsesRemaining: number;
  maxPulses: number;
  comboStreak: number;
  bestCombo: number;
  multiplier: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  wordsCompleted: number;
  activePlayTimeMs: number;
  mistypedLetters: Record<string, number>; // counts frequency of expected letters missed
}

export interface GameConfiguration {
  mode: GameMode;
  difficulty: Difficulty;
  category: WordCategory;
  customWords: string[];
  practiceTimedMinutes: number; // 0 = untimed
  practiceRelaxed: boolean;
  practicePace: 'slow' | 'normal' | 'fast';
  reducedMotion: boolean;
}

export interface WaveConfig {
  waveNumber: number;
  totalEnemies: number;
  spawnIntervalMs: number;
  speedMultiplier: number;
  scoutCount: number;
  fighterCount: number;
  heavyCount: number;
}
