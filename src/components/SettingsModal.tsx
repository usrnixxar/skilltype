import { X, Sliders } from 'lucide-react';
import { UserSettings } from '../utils/storage';
import soundEngine from '../audio/SoundEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    soundEngine.setSfxVolume(val);
    onUpdateSettings({ sfxVolume: val });
  };

  const handleMusicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    soundEngine.setMusicVolume(val);
    onUpdateSettings({ musicVolume: val });
  };

  const handleMuteToggle = () => {
    const nextMuted = !settings.isMuted;
    soundEngine.setMuted(nextMuted);
    onUpdateSettings({ isMuted: nextMuted });
  };

  const handleReducedMotionToggle = () => {
    onUpdateSettings({ reducedMotion: !settings.reducedMotion });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal-panel settings-panel">
        <div className="modal-header">
          <div className="modal-title-row">
            <Sliders size={22} className="text-cyan" />
            <h2 id="settings-title" className="modal-title">Audio & Visual Settings</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close Settings">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* 1. Master Audio Mute */}
          <div className="setting-row setting-toggle-row">
            <div className="setting-info">
              <span className="setting-name">Master Mute</span>
              <span className="setting-desc">Silence all synthesized lasers, impacts, and ambient drone</span>
            </div>
            <button
              className={`toggle-switch ${settings.isMuted ? 'active' : ''}`}
              onClick={handleMuteToggle}
              role="switch"
              aria-checked={settings.isMuted}
              aria-label="Toggle Master Audio Mute"
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          {/* 2. SFX Volume */}
          <div className="setting-row">
            <div className="setting-slider-header">
              <div className="setting-info">
                <span className="setting-name">Sound Effects Volume</span>
                <span className="setting-desc">Laser fire, explosions, and keystroke blips</span>
              </div>
              <span className="setting-value-badge">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.sfxVolume}
              onChange={handleSfxChange}
              disabled={settings.isMuted}
              className="settings-slider"
              aria-label="Sound Effects Volume"
            />
          </div>

          {/* 3. Ambient Space Drone Volume */}
          <div className="setting-row">
            <div className="setting-slider-header">
              <div className="setting-info">
                <span className="setting-name">Ambient Space Drone</span>
                <span className="setting-desc">Atmospheric synthesizer background hum</span>
              </div>
              <span className="setting-value-badge">
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.musicVolume}
              onChange={handleMusicChange}
              disabled={settings.isMuted}
              className="settings-slider"
              aria-label="Ambient Space Drone Volume"
            />
          </div>

          {/* 4. Reduced Motion */}
          <div className="setting-row setting-toggle-row">
            <div className="setting-info">
              <span className="setting-name">Reduced Motion</span>
              <span className="setting-desc">
                Disables screen shake, minimizes particle counts, and calms starfield parallax
              </span>
            </div>
            <button
              className={`toggle-switch ${settings.reducedMotion ? 'active' : ''}`}
              onClick={handleReducedMotionToggle}
              role="switch"
              aria-checked={settings.reducedMotion}
              aria-label="Toggle Reduced Motion"
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
