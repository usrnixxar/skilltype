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
  onTriggerPulse,
  onEndPractice,
}) => {
  return (
    <div className="gameplay-hud" role="region" aria-label="Game HUD">
      {/* Bottom HUD Bar: Shields, Spaceship line, Emergency Pulse */}
      <div className="hud-bottom-bar">
        {/* Shields (Lives) */}
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
            <button
              className="btn btn-sm btn-secondary hud-end-practice-btn"
              onClick={onEndPractice}
            >
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
