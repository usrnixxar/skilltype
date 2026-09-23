import React from 'react';
import { Play, BookOpen, Trophy, Sliders, HelpCircle } from 'lucide-react';
import { Difficulty, PersonalBest } from '../utils/storage';

interface MainMenuProps {
  onStartArcade: () => void;
  onOpenPractice: () => void;
  onOpenHowToPlay: () => void;
  onOpenRecords: () => void;
  onOpenSettings: () => void;
  difficulty: Difficulty;
  onChangeDifficulty: (diff: Difficulty) => void;
  currentBest: PersonalBest | null;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartArcade,
  onOpenPractice,
  onOpenHowToPlay,
  onOpenRecords,
  onOpenSettings,
  difficulty,
  onChangeDifficulty,
  currentBest,
}) => {
  return (
    <div className="main-menu-overlay" role="region" aria-label="Main Menu">
      <div className="menu-container">
        {/* Brand Hero */}
        <div className="menu-hero">
          <div className="hero-emblem">
            <svg viewBox="0 0 40 40" width="48" height="48" aria-hidden="true">
              <defs>
                <linearGradient id="emblemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" />
                  <stop offset="100%" stopColor="#3a86ff" />
                </linearGradient>
              </defs>
              <polygon points="20,2 36,36 20,28 4,36" fill="url(#emblemGrad)" stroke="#00f0ff" strokeWidth="1.5" />
              <polygon points="20,9 29,31 20,25 11,31" fill="#060b1e" />
              <circle cx="20" cy="18" r="3" fill="#00f0ff" />
            </svg>
          </div>
          <h1 className="hero-title">SkillType</h1>
          <p className="hero-tagline">Type Fast. Aim Higher.</p>
        </div>

        {/* Personal Best Snapshot */}
        {currentBest && (
          <div className="menu-best-banner">
            <span className="best-label">ARCADE RECORD ({difficulty.toUpperCase()}):</span>
            <span className="best-score">{currentBest.score.toLocaleString()} pts</span>
            <span className="best-meta">• {currentBest.wpm} WPM • Wave {currentBest.wave}</span>
          </div>
        )}

        {/* Difficulty Selector */}
        <div className="menu-difficulty-row">
          <span className="difficulty-title">DIFFICULTY:</span>
          <div className="difficulty-pill-group" role="radiogroup" aria-label="Difficulty Selection">
            {(['beginner', 'normal', 'expert'] as Difficulty[]).map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={difficulty === d}
                className={`difficulty-pill ${difficulty === d ? 'active' : ''}`}
                onClick={() => onChangeDifficulty(d)}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="menu-buttons-list">
          <button className="menu-btn menu-btn-primary" onClick={onStartArcade}>
            <Play size={20} className="menu-btn-icon" />
            <div className="menu-btn-text">
              <span className="btn-main-title">Play Arcade</span>
              <span className="btn-sub-title">Defend against escalating enemy fleets</span>
            </div>
          </button>

          <button className="menu-btn menu-btn-secondary" onClick={onOpenPractice}>
            <BookOpen size={20} className="menu-btn-icon" />
            <div className="menu-btn-text">
              <span className="btn-main-title">Practice Mode</span>
              <span className="btn-sub-title">Curated tech terms, custom lists & relaxed mode</span>
            </div>
          </button>

          <div className="menu-secondary-grid">
            <button className="menu-btn-compact" onClick={onOpenHowToPlay}>
              <HelpCircle size={18} />
              <span>How to Play</span>
            </button>

            <button className="menu-btn-compact" onClick={onOpenRecords}>
              <Trophy size={18} />
              <span>Records</span>
            </button>

            <button className="menu-btn-compact" onClick={onOpenSettings}>
              <Sliders size={18} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
