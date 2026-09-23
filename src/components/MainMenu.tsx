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
        {/* Brand Hero with Skillence Academy Logo in a Neon Cyber-Circle */}
        <div className="menu-hero">
          <div className="hero-logo-wrapper" aria-label="Skillence Academy Logo">
            <div className="hero-logo-orbit" />
            <div className="hero-logo-circle">
              <img
                src="/skillence-logo.jpg"
                alt="Skillence Academy"
                className="hero-logo-img"
              />
            </div>
            <div className="hero-logo-badge">SKILLENCE</div>
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
