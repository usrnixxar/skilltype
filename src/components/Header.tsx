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
          <div className="header-logo-circle">
            <img
              src="/skillence-logo.jpg"
              alt="Skillence Academy"
              className="header-logo-img"
            />
          </div>
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
            if (!nextMute) {
              soundEngine.resumeMusic();
            }
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
