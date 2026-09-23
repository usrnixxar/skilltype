// LocalStorage persistence manager for SkillType
// Handles settings, personal bests, and recent session records with corruption recovery.

import { WordCategory } from '../data/wordLists';

export type Difficulty = 'beginner' | 'normal' | 'expert';
export type GameMode = 'arcade' | 'practice';

export interface UserSettings {
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  reducedMotion: boolean;
  difficulty: Difficulty;
  category: WordCategory;
  practiceTimedMinutes: number; // 0 = untimed, 1, 3, 5
  practiceRelaxed: boolean;
  practicePace: 'slow' | 'normal' | 'fast';
  customWordsRaw: string;
}

export interface SessionRecord {
  id: string;
  date: string;
  mode: GameMode;
  difficulty: Difficulty;
  score: number;
  wpm: number;
  accuracy: number;
  wave: number;
  wordsCompleted: number;
  durationSeconds: number;
}

export interface PersonalBest {
  score: number;
  wpm: number;
  accuracy: number;
  wave: number;
  date: string;
}

export interface GameRecords {
  personalBests: Record<string, PersonalBest>; // Key: `${mode}_${difficulty}`
  recentSessions: SessionRecord[];             // Capped at 50
}

const SETTINGS_KEY = 'skilltype_settings_v1';
const RECORDS_KEY = 'skilltype_records_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  sfxVolume: 0.7,
  musicVolume: 0.35,
  isMuted: false,
  reducedMotion: false,
  difficulty: 'normal',
  category: 'common',
  practiceTimedMinutes: 0,
  practiceRelaxed: true,
  practicePace: 'normal',
  customWordsRaw: ''
};

export const DEFAULT_RECORDS: GameRecords = {
  personalBests: {},
  recentSessions: []
};

// In-memory fallback if localStorage is disabled or throws QuotaExceededError
let memorySettings: UserSettings = { ...DEFAULT_SETTINGS };
let memoryRecords: GameRecords = { ...DEFAULT_RECORDS };

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

function isStorageAvailable(): boolean {
  try {
    const storage = getLocalStorage();
    if (!storage) return false;
    const testKey = '__skilltype_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads user settings safely with fallback.
 */
export function loadSettings(): UserSettings {
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) {
    return { ...memorySettings };
  }

  try {
    const item = storage.getItem(SETTINGS_KEY);
    if (!item) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(item);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('Failed to parse SkillType settings, resetting to defaults.', err);
    saveSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves user settings safely.
 */
export function saveSettings(settings: UserSettings): void {
  memorySettings = { ...settings };
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) return;

  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Unable to write to localStorage for settings:', err);
  }
}

/**
 * Loads game records and personal bests safely with corruption recovery.
 */
export function loadRecords(): GameRecords {
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) {
    return { ...memoryRecords };
  }

  try {
    const item = storage.getItem(RECORDS_KEY);
    if (!item) return { ...DEFAULT_RECORDS };
    const parsed = JSON.parse(item);
    return {
      personalBests: parsed.personalBests || {},
      recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : []
    };
  } catch (err) {
    console.warn('Corrupted SkillType records detected in localStorage, recovering defaults.', err);
    saveRecords(DEFAULT_RECORDS);
    return { ...DEFAULT_RECORDS };
  }
}

/**
 * Saves all game records safely.
 */
export function saveRecords(records: GameRecords): void {
  memoryRecords = { ...records };
  const storage = getLocalStorage();
  if (!storage || !isStorageAvailable()) return;

  try {
    storage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Unable to write to localStorage for records:', err);
  }
}

/**
 * Records a completed session, updates personal bests if applicable, and caps recent history to 50 entries.
 * Returns true if this session achieved a new personal best score for the given mode & difficulty.
 */
export function recordCompletedSession(record: Omit<SessionRecord, 'id' | 'date'>): { isNewPersonalBest: boolean; updatedRecords: GameRecords } {
  const records = loadRecords();
  const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const date = new Date().toISOString();

  const newSession: SessionRecord = {
    ...record,
    id,
    date
  };

  // Prepend new session and cap at 50
  const recentSessions = [newSession, ...records.recentSessions].slice(0, 50);

  // Check personal best
  const pbKey = `${record.mode}_${record.difficulty}`;
  const existingPb = records.personalBests[pbKey];
  let isNewPersonalBest = false;

  const personalBests = { ...records.personalBests };

  if (!existingPb || record.score > existingPb.score) {
    isNewPersonalBest = true;
    personalBests[pbKey] = {
      score: record.score,
      wpm: record.wpm,
      accuracy: record.accuracy,
      wave: record.wave,
      date
    };
  }

  const updatedRecords: GameRecords = {
    personalBests,
    recentSessions
  };

  saveRecords(updatedRecords);
  return { isNewPersonalBest, updatedRecords };
}

/**
 * Clears saved records with confirmation.
 */
export function clearAllRecords(): void {
  saveRecords(DEFAULT_RECORDS);
}
