import React from 'react';
import { GameStats } from '../game/types';
import { GameMode } from '../utils/storage';
import { PlayerProfile } from '../utils/playerProfile';
import { User, Flame, Clock, UserCheck } from 'lucide-react';

interface LiveStatsPanelProps {
  stats: GameStats;
  mode: GameMode;
  activePlayer: PlayerProfile | null;
  practiceTimedMs?: number;
  isRelaxed?: boolean;
  onChangePlayer: () => void;
  isPlaying: boolean;
}

export const LiveStatsPanel: React.FC<LiveStatsPanelProps> = ({
  stats,
  mode,
  activePlayer,
  practiceTimedMs = 0,
  isRelaxed = false,
  onChangePlayer,
  isPlaying,
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
    <div className="side-panel live-stats-panel" aria-label="Live Player Statistics">
      <div className="panel-header">
        <div className="panel-title-row">
          <div className="panel-indicator-dot pulse" />
          <h2 className="panel-title">LIVE STATS</h2>
        </div>
        <span className="panel-badge-status">
          {isPlaying ? 'ACTIVE RUN' : 'STANDBY'}
        </span>
      </div>

      {/* Player Profile Card */}
      <div className="stats-player-card">
        <div className="player-avatar-circle">
          <User size={18} />
        </div>
        <div className="player-meta-block">
          <div className="player-meta-label">PILOT</div>
          <div className="player-meta-name" title={activePlayer?.name || 'Guest Pilot'}>
            {activePlayer?.name || 'Guest Pilot'}
          </div>
        </div>
        <button
          type="button"
          className="btn-change-player"
          onClick={onChangePlayer}
          title="Change Player Profile"
          aria-label="Change Player"
        >
          <UserCheck size={13} />
          <span>Change</span>
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="stats-metrics-list">
        {/* SCORE */}
        <div className="stat-card stat-card-score">
          <div className="stat-card-label">SCORE</div>
          <div className="stat-card-value stat-score-value">
            {stats.score.toLocaleString()}
          </div>
        </div>

        {/* WAVE */}
        <div className="stat-card stat-card-wave">
          <div className="stat-card-label">
            {mode === 'arcade' ? 'CURRENT WAVE' : 'MODE'}
          </div>
          <div className="stat-card-value stat-wave-value">
            {mode === 'arcade'
              ? `WAVE ${stats.wave}`
              : isRelaxed
              ? 'Relaxed'
              : `WAVE ${stats.wave}`}
          </div>
        </div>

        {/* COMBO */}
        <div className="stat-card stat-card-combo">
          <div className="stat-card-label-flex">
            <span className="stat-card-label">COMBO MULTIPLIER</span>
            <span className={`combo-multiplier-pill mult-pill-x${stats.multiplier}`}>
              x{stats.multiplier}
            </span>
          </div>
          <div className="combo-streak-row">
            <Flame size={14} className="combo-flame-icon" />
            <span className="combo-streak-text">
              {stats.comboStreak} {stats.comboStreak === 1 ? 'word' : 'words'} streak
            </span>
          </div>
          <div className="panel-combo-meter-bg">
            <div
              className={`panel-combo-meter-fill mult-bg-${stats.multiplier}`}
              style={{ width: `${comboProgress}%` }}
            />
          </div>
        </div>

        {/* ACCURACY */}
        <div className="stat-card stat-card-accuracy">
          <div className="stat-card-label">ACCURACY</div>
          <div className="stat-card-value stat-mono-value">
            {accuracyStr}
          </div>
          <div className="stat-card-subtext">
            {stats.correctKeystrokes} correct / {stats.incorrectKeystrokes} miss
          </div>
        </div>

        {/* WPM */}
        <div className="stat-card stat-card-wpm">
          <div className="stat-card-label">SPEED (WPM)</div>
          <div className="stat-card-value stat-mono-value stat-wpm-value">
            {wpmStr}
          </div>
          <div className="stat-card-subtext">Net Words Per Minute</div>
        </div>

        {/* Practice Timer Countdown if applicable */}
        {mode === 'practice' && practiceTimedMs > 0 && (
          <div className="stat-card stat-card-timer">
            <div className="stat-card-label-flex">
              <span className="stat-card-label">TIME REMAINING</span>
              <Clock size={14} className="timer-icon" />
            </div>
            <div className="stat-card-value stat-mono-value stat-timer-value">
              {formatTimer(practiceTimedMs)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
