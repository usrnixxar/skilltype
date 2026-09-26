import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import soundEngine from '../audio/SoundEngine';

describe('SoundEngine Background Music', () => {
  let activeAudioInstance: any;

  beforeAll(() => {
    (globalThis as any).window = globalThis;

    activeAudioInstance = {
      src: '',
      loop: false,
      preload: '',
      volume: 1,
      paused: true,
      currentTime: 0,
      play: vi.fn(function (this: any) {
        this.paused = false;
        return Promise.resolve();
      }),
      pause: vi.fn(function (this: any) {
        this.paused = true;
      }),
    };

    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation((src: string) => {
        activeAudioInstance.src = src;
        return activeAudioInstance;
      })
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    soundEngine.setMuted(false);
    soundEngine.setMusicVolume(0.35);
  });

  it('initializes and plays Typing_Flow_60s.mp3 with looping', () => {
    soundEngine.startMusic();
    expect(activeAudioInstance.src).toBe('/Typing_Flow_60s.mp3');
    expect(activeAudioInstance.loop).toBe(true);
    expect(activeAudioInstance.preload).toBe('auto');
    expect(activeAudioInstance.play).toHaveBeenCalled();
  });

  it('updates background music volume accurately', () => {
    soundEngine.startMusic();
    soundEngine.setMusicVolume(0.65);
    expect(soundEngine.getMusicVolume()).toBe(0.65);
    expect(activeAudioInstance.volume).toBeCloseTo(0.65);
  });

  it('mutes and unmutes background music cleanly', () => {
    soundEngine.startMusic();
    soundEngine.setMusicVolume(0.5);

    // Mute
    soundEngine.setMuted(true);
    expect(soundEngine.getIsMuted()).toBe(true);
    expect(activeAudioInstance.volume).toBe(0);

    // Unmute restores volume
    soundEngine.setMuted(false);
    expect(soundEngine.getIsMuted()).toBe(false);
    expect(activeAudioInstance.volume).toBeCloseTo(0.5);
  });

  it('supports pause and resume for background music', () => {
    soundEngine.startMusic();
    soundEngine.pauseMusic();
    expect(activeAudioInstance.pause).toHaveBeenCalled();

    soundEngine.resumeMusic();
    expect(activeAudioInstance.play).toHaveBeenCalled();
  });

  it('supports stopping and resetting track position', () => {
    soundEngine.startMusic();
    activeAudioInstance.currentTime = 25;
    soundEngine.stopMusic();
    expect(activeAudioInstance.pause).toHaveBeenCalled();
    expect(activeAudioInstance.currentTime).toBe(0);
  });
});
