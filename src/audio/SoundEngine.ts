// Procedural Web Audio API Sound Synthesizer for SkillType
// 100% self-contained: no external audio files or network requests required.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Ambient Drone nodes
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying = false;

  private sfxVolume = 0.7;
  private musicVolume = 0.35;
  private isMuted = false;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX Gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Music / Ambient Gain
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      // Pre-generate 2 seconds of white noise for explosions & pulses
      const sampleRate = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < sampleRate * 2; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } catch {
      // AudioContext unavailable or restricted
    }
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  public getSfxVolume() {
    return this.sfxVolume;
  }

  public getMusicVolume() {
    return this.musicVolume;
  }

  public getIsMuted() {
    return this.isMuted;
  }

  // --- Sound Effects ---

  // 1. Correct character typed (light mechanical/electronic blip)
  public playKeyHit() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100 + Math.random() * 100, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.04);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  // 2. Laser bolt fired toward enemy
  public playLaser() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.07);

    // Subtle low-pass to soften the harshness of the sawtooth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  // 3. Incorrect keystroke (low thud/error buzzer)
  public playError() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(85, t + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  // 4. Enemy destruction explosion (crunchy filtered noise + sub-bass boom)
  public playExplosion(intensity: 'small' | 'medium' | 'large' = 'medium') {
    this.initContext();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.isMuted) return;

    const t = this.ctx.currentTime;
    const duration = intensity === 'large' ? 0.5 : intensity === 'medium' ? 0.35 : 0.22;
    const peakGain = intensity === 'large' ? 0.6 : intensity === 'medium' ? 0.45 : 0.3;

    // Noise component
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + duration);
    filter.Q.setValueAtTime(1.5, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(peakGain, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    // Sub-bass impact
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, t);
    subOsc.frequency.exponentialRampToValueAtTime(35, t + duration);

    subGain.gain.setValueAtTime(peakGain * 0.8, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + duration);
    subOsc.start(t);
    subOsc.stop(t + duration);
  }

  // 5. Wave complete victory fanfare (ascending arpeggio chord)
  public playWaveComplete() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const step = 0.08;

    notes.forEach((freq, index) => {
      if (!this.ctx || !this.sfxGain) return;
      const noteTime = t + index * step;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.25, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  // 6. Lost life alarm (dissonant warning siren)
  public playLifeLost() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.frequency.setValueAtTime(260, t);
    osc1.frequency.linearRampToValueAtTime(140, t + 0.28);

    osc2.frequency.setValueAtTime(277, t); // Half-step dissonance
    osc2.frequency.linearRampToValueAtTime(155, t + 0.28);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.28);
    osc2.stop(t + 0.28);
  }

  // 7. Emergency pulse shockwave (resonant sub-sweep + expansive whoosh)
  public playPulse() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.isMuted) return;

    const t = this.ctx.currentTime;
    const duration = 0.8;

    // Sub-bass sweep
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + duration);

    oscGain.gain.setValueAtTime(0.7, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    // Filtered noise sweep
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + duration);
    filter.Q.setValueAtTime(4, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    osc.start(t);
    noise.start(t);
    osc.stop(t + duration);
    noise.stop(t + duration);
  }

  // 8. Game Over melancholy chord descent
  public playGameOver() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const notes = [311.13, 261.63, 196.0]; // Eb4, C4, G3
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const noteTime = t + i * 0.18;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.6);
    });
  }

  // 9. Ambient atmospheric deep space drone
  public startAmbientDrone() {
    if (this.isAmbientPlaying) return;
    this.initContext();
    if (!this.ctx || !this.musicGain) return;

    try {
      const t = this.ctx.currentTime;

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.001, t);
      this.ambientGain.gain.linearRampToValueAtTime(0.4, t + 2); // Gentle 2s fade-in

      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(140, t);

      // Dual detuned oscillators for rich celestial resonance
      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc2 = this.ctx.createOscillator();

      this.ambientOsc1.type = 'sawtooth';
      this.ambientOsc1.frequency.setValueAtTime(55, t); // A1 note

      this.ambientOsc2.type = 'sine';
      this.ambientOsc2.frequency.setValueAtTime(55.5, t); // Slightly detuned

      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientOsc2.connect(this.ambientFilter);
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.musicGain);

      this.ambientOsc1.start(t);
      this.ambientOsc2.start(t);

      this.isAmbientPlaying = true;
    } catch {
      // AudioContext error
    }
  }

  public stopAmbientDrone() {
    if (!this.isAmbientPlaying || !this.ctx || !this.ambientGain) return;

    try {
      const t = this.ctx.currentTime;
      this.ambientGain.gain.setTargetAtTime(0.0001, t, 0.4);

      setTimeout(() => {
        try {
          this.ambientOsc1?.stop();
          this.ambientOsc2?.stop();
          this.ambientOsc1?.disconnect();
          this.ambientOsc2?.disconnect();
          this.ambientFilter?.disconnect();
          this.ambientGain?.disconnect();
        } catch {}
        this.ambientOsc1 = null;
        this.ambientOsc2 = null;
        this.ambientFilter = null;
        this.ambientGain = null;
        this.isAmbientPlaying = false;
      }, 500);
    } catch {
      this.isAmbientPlaying = false;
    }
  }
}

export const soundEngine = new SoundEngine();
export default soundEngine;
