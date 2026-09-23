import React from 'react';
import { GameStats } from '../game/types';
import { GameMode } from '../utils/storage';
import { Zap, Shield } from 'lucide-react';

interface GameplayHUDProps {
  stats: GameStats;
  mode: GameMode;
  practiceTimedMs: number;
  isRelaxed: boolean;
  onTriggerPulse: () => void;
  onEndPractice?: () => void;
}

export const GameplayHUD: React.FC<GameplayHUDProps> = ({
  stats,
  mode,
  practiceTimedMs,
  isRelaxed,
  onTriggerPulse,
  onEndPractice,
}) => {
  // Format Accuracy
  const totalKeystrokes = stats.correctKeystrokes + stats.incorrectKeystrokes;
  const accuracyStr =
    totalKeystrokes > 0
      ? `${Math.round((stats.correctKeystrokes / totalKeystrokes) * 100)}%`
      : '—';

  // Format WPM: (correctKeys / 5) / (activePlayTimeMinutes)
  const activeMinutes = stats.activePlayTimeMs / 60000;
  const wpmStr =
    activeMinutes > 0.05 && stats.correctKeystrokes > 0
      ? `${Math.round((stats.correctKeystrokes / 5) / activeMinutes)}`
      : '—';

  // Practice timer formatting
  const formatTimer = (ms: number) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Combo progress toward next multiplier
  // x1 (0-4), x2 (5-9), x3 (10-19), x4 (20+)
  let nextThreshold = 5;
  let prevThreshold = 0;
  if (stats.comboStreak >= 10) {
    prevThreshold = 10;
    nextThreshold = 20;
  } else if (stats.comboStreak >= 5) {
    prevThreshold = 5;
    nextThreshold = 10;
  }

  const comboProgress =
    stats.multiplier >= 4
      ? 100
      : Math.min(100, Math.max(0, ((stats.comboStreak - prevThreshold) / (nextThreshold - prevThreshold)) * 100));

  return (
    <div className="gameplay-hud" role="region" aria-label="Game HUD">
      {/* Top HUD Bar */}
      <div className="hud-top-bar">
        {/* Score & Multiplier */}
        <div className="hud-group hud-score-group">
          <div className="hud-label">SCORE</div>
          <div className="hud-value hud-score-val">{stats.score.toLocaleString()}</div>
        </div>

        {/* Wave Indicator */}
        <div className="hud-group hud-wave-group">
          <div className="hud-label">{mode === 'arcade' ? 'WAVE' : 'PRACTICE'}</div>
          <div className="hud-value hud-wave-val">
            {mode === 'arcade' ? stats.wave : isRelaxed ? 'Relaxed' : `W-${stats.wave}`}
          </div>
        </div>

        {/* Combo Gauge */}
        <div className="hud-group hud-combo-group">
          <div className="hud-label-flex">
            <span className="hud-label">COMBO</span>
            <span className={`hud-multiplier mult-x${stats.multiplier}`}>x{stats.multiplier}</span>
          </div>
          <div className="combo-meter-bg">
            <div
              className={`combo-meter-fill mult-bg-${stats.multiplier}`}
              style={{ width: `${comboProgress}%` }}
            />
          </div>
        </div>

        {/* Live Accuracy */}
        <div className="hud-group hud-stat-group">
          <div className="hud-label">ACCURACY</div>
          <div className="hud-value hud-mono">{accuracyStr}</div>
        </div>

        {/* Live WPM */}
        <div className="hud-group hud-stat-group">
          <div className="hud-label">WPM</div>
          <div className="hud-value hud-mono">{wpmStr}</div>
        </div>

        {/* Optional Practice Timed Countdown */}
        {mode === 'practice' && practiceTimedMs > 0 && (
          <div className="hud-group hud-timer-group">
            <div className="hud-label">TIME LEFT</div>
            <div className="hud-value hud-timer-val">{formatTimer(practiceTimedMs)}</div>
          </div>
        )}
      </div>

      {/* Bottom HUD Bar: Lives, Pulses, Controls */}
      <div className="hud-bottom-bar">
        {/* Lives */}
        <div className="hud-bottom-left">
          <div className="hud-lives-container">
            <span className="hud-sublabel">SHIELDS</span>
            <div className="hud-lives-icons" aria-label={`${stats.lives} shields remaining`}>
              {Array.from({ length: stats.maxLives }).map((_, i) => (
                <div
                  key={i}
                  className={`life-icon ${i < stats.lives ? 'life-active' : 'life-lost'}`}
                >
                  <Shield size={18} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center / Right: Pulses and Practice Controls */}
        <div className="hud-bottom-right">
          {mode === 'practice' && onEndPractice && (
            <button className="btn btn-sm btn-secondary hud-end-practice-btn" onClick={onEndPractice}>
              End Practice
            </button>
          )}

          {/* Emergency Pulses Button */}
          <div className="hud-pulse-container">
            <button
              className={`hud-pulse-btn ${stats.pulsesRemaining > 0 ? 'pulse-ready' : 'pulse-empty'}`}
              onClick={onTriggerPulse}
              disabled={stats.pulsesRemaining <= 0}
              aria-label={`Trigger Emergency Pulse. ${stats.pulsesRemaining} remaining.`}
              title="Emergency Pulse [SPACE]"
            >
              <Zap size={16} />
              <span className="pulse-text">PULSE</span>
              <span className="pulse-key-badge">SPACE</span>
            </button>
            <div className="pulse-pips">
              {Array.from({ length: stats.maxPulses }).map((_, i) => (
                <div
                  key={i}
                  className={`pulse-pip ${i < stats.pulsesRemaining ? 'pip-full' : 'pip-spent'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
