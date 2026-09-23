import React from 'react';
import { Volume2, VolumeX, Pause, Play, Settings } from 'lucide-react';
import soundEngine from '../audio/SoundEngine';

interface HeaderProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPauseToggle: () => void;
  onOpenSettings: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isPlaying,
  isPaused,
  onPauseToggle,
  onOpenSettings,
  isMuted,
  onToggleMute,
}) => {
  return (
    <header className="skilltype-header" role="banner">
      <div className="header-left">
        <div className="brand-logo" aria-label="SkillType Logo">
          <svg className="brand-ship-icon" viewBox="0 0 32 32" width="24" height="24">
            <defs>
              <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="100%" stopColor="#3a86ff" />
              </linearGradient>
            </defs>
            <polygon points="16,2 29,28 16,22 3,28" fill="url(#headerGrad)" stroke="#00f0ff" strokeWidth="1.2" />
            <polygon points="16,7 23,24 16,20 9,24" fill="#070e24" />
            <circle cx="16" cy="15" r="2.5" fill="#00f0ff" />
          </svg>
          <span className="brand-title">SkillType</span>
        </div>
        <span className="brand-tagline">Type Fast. Aim Higher.</span>
      </div>

      <div className="header-right">
        {isPlaying && (
          <button
            className="header-btn"
            onClick={onPauseToggle}
            aria-label={isPaused ? 'Resume Game' : 'Pause Game'}
            title={isPaused ? 'Resume (ESC)' : 'Pause (ESC)'}
          >
            {isPaused ? <Play size={17} /> : <Pause size={17} />}
            <span className="btn-label">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        )}

        <button
          className="header-btn"
          onClick={() => {
            const nextMute = !isMuted;
            soundEngine.setMuted(nextMute);
            onToggleMute();
          }}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <button
          className="header-btn"
          onClick={onOpenSettings}
          aria-label="Game Settings"
          title="Settings"
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
};
