import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeCustomWords, categorizeCustomWords } from '../data/wordLists';
import {
  loadRecords,
  saveRecords,
  recordCompletedSession,
  DEFAULT_RECORDS,
} from '../utils/storage';

describe('Word Normalization and Custom Input', () => {
  it('normalizes, deduplicates, and filters custom pasted vocabulary', () => {
    const rawInput = 'React, TypeScript, vite, REact, 123, a, looooooooongwordthatiswaytoolongtotype, space-shooter';
    const { validWords, rejectedCount } = normalizeCustomWords(rawInput);

    expect(validWords).toContain('react');
    expect(validWords).toContain('typescript');
    expect(validWords).toContain('vite');

    // Deduplication
    expect(validWords.filter((w) => w === 'react').length).toBe(1);

    // Rejected items: '123' (empty after regex), 'a' (too short), 'looooooooongwordthatiswaytoolongtotype' (>15 chars)
    expect(rejectedCount).toBeGreaterThanOrEqual(2);
  });

  it('categorizes custom words into short, medium, and long buckets', () => {
    const words = ['star', 'orbit', 'constellation'];
    const buckets = categorizeCustomWords(words);

    expect(buckets.short).toContain('star');
    expect(buckets.medium).toContain('orbit');
    expect(buckets.long).toContain('constellation');
  });
});

describe('Storage & Records Persistence', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
      length: 0,
      key: () => null,
    } as unknown as Storage;

    (globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage;
    (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: mockStorage };

    // Reset test storage
    saveRecords(DEFAULT_RECORDS);
  });

  it('detects and recovers safely from corrupted localStorage data', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      'skilltype_records_v1',
      'INVALID_JSON_CORRUPT{[['
    );
    const recovered = loadRecords();

    expect(recovered).toBeDefined();
    expect(recovered.recentSessions).toEqual([]);
    expect(recovered.personalBests).toEqual({});
  });

  it('records completed session and correctly updates personal best', () => {
    const firstRun = recordCompletedSession({
      mode: 'arcade',
      difficulty: 'normal',
      score: 5000,
      wpm: 65,
      accuracy: 94,
      wave: 3,
      wordsCompleted: 24,
      durationSeconds: 120,
    });

    expect(firstRun.isNewPersonalBest).toBe(true);
    expect(firstRun.updatedRecords.personalBests['arcade_normal'].score).toBe(5000);

    // Run with lower score
    const secondRun = recordCompletedSession({
      mode: 'arcade',
      difficulty: 'normal',
      score: 3000,
      wpm: 50,
      accuracy: 85,
      wave: 2,
      wordsCompleted: 15,
      durationSeconds: 90,
    });

    expect(secondRun.isNewPersonalBest).toBe(false);
    expect(secondRun.updatedRecords.personalBests['arcade_normal'].score).toBe(5000);
    expect(secondRun.updatedRecords.recentSessions.length).toBe(2);
  });
});
