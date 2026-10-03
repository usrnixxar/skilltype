import React, { useState, useEffect } from 'react';
import {
  PlayerProfile,
  validatePlayerName,
  createPlayerProfile,
  loadAllLocalPlayers,
  saveActivePlayer,
  getOrCreatePlayerId,
  getPlayerName,
  STORAGE_KEY_PLAYER_NAME,
  STORAGE_KEY_PLAYER_ID,
} from '../utils/playerProfile';
import { registerPlayerWithServer } from '../utils/leaderboardApi';
import { User, Play, Users, X, Check } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  activePlayer: PlayerProfile | null;
  onSavePlayerAndStart: (profile: PlayerProfile) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  activePlayer,
  onSavePlayerAndStart,
  onClose,
  canClose = false,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [localProfiles, setLocalProfiles] = useState<PlayerProfile[]>([]);
  const [showSwitchList, setShowSwitchList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const profiles = loadAllLocalPlayers();
      setLocalProfiles(profiles);
      const savedName = getPlayerName(activePlayer?.name);
      if (savedName) {
        setName(savedName);
      } else {
        setName('');
      }
      setError(null);
      setShowSwitchList(false);
    }
  }, [isOpen, activePlayer]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const playerName = name.trim();

    // Step 1 Validation
    if (!playerName || playerName.length < 2) {
      setError('Please enter your name');
      return;
    }

    const validation = validatePlayerName(playerName);
    if (!validation.valid) {
      setError(validation.error || 'Please enter your name');
      return;
    }

    const validName = validation.trimmedName;
    const playerId = activePlayer?.id || getOrCreatePlayerId();

    // Step 11 Order:
    // 1. Validate name (done above)
    // 2. Save playerName
    try {
      localStorage.setItem(STORAGE_KEY_PLAYER_NAME, validName);
      // 3. Save/generate playerId
      localStorage.setItem(STORAGE_KEY_PLAYER_ID, playerId);
    } catch {}

    const profile = createPlayerProfile(validName, playerId);
    registerPlayerWithServer(profile.id, profile.name);

    // 4. Start game
    onSavePlayerAndStart(profile);
  };

  const handleSelectExistingProfile = (profile: PlayerProfile) => {
    saveActivePlayer(profile);
    registerPlayerWithServer(profile.id, profile.name);
    onSavePlayerAndStart(profile);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="modal-content welcome-modal-content">
        {canClose && onClose && (
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            title="Cancel"
          >
            <X size={18} />
          </button>
        )}

        <div className="welcome-modal-header">
          <div className="welcome-brand-badge">
            <div className="welcome-logo-circle">
              <img src="/favicon.svg" alt="SkillType Starfighter" />
            </div>
            <span className="welcome-badge-text">SKILLENCE ACADEMY</span>
          </div>

          <h2 className="welcome-title" id="welcome-title">
            Enter Player Name
          </h2>
          <p className="welcome-subtitle">
            Enter your name to compete on the weekly and daily leaderboards.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="welcome-form">
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="player-name-input" className="form-label">
                <User size={14} className="label-icon" /> Your Name
              </label>
              <span className="char-counter">
                {name.length}/25
              </span>
            </div>

            <div className="input-with-glow">
              <input
                id="player-name-input"
                type="text"
                className={`text-input player-name-input ${error ? 'input-error' : ''}`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={25}
                placeholder="e.g. Nisar, Rehan, Rahul Kumar"
                autoFocus
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {error && <div className="form-error-msg">{error}</div>}

            <p className="form-hint">
              Name is mandatory • 2–25 characters (spaces allowed) • Stored for convenience
            </p>
          </div>

          <button type="submit" className="btn btn-primary btn-welcome-start">
            <Play size={18} className="btn-icon" />
            <span>Start Typing</span>
          </button>
        </form>

        {/* Shared Computer Student Profiles */}
        {localProfiles.length > 0 && (
          <div className="welcome-shared-computer-section">
            <button
              type="button"
              className="btn-link-switch-players"
              onClick={() => setShowSwitchList((prev) => !prev)}
            >
              <Users size={14} />
              <span>
                {showSwitchList ? 'Hide profiles' : `Switch saved player on this device (${localProfiles.length})`}
              </span>
            </button>

            {showSwitchList && (
              <div className="shared-profiles-list">
                <div className="shared-profiles-header">
                  <span>Select player profile:</span>
                </div>
                <div className="shared-profiles-items">
                  {localProfiles.map((p) => {
                    const isCurrent = activePlayer?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`shared-profile-item ${isCurrent ? 'current' : ''}`}
                        onClick={() => handleSelectExistingProfile(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectExistingProfile(p)}
                      >
                        <div className="shared-profile-info">
                          <span className="shared-profile-name">{p.name}</span>
                          <span className="shared-profile-meta">
                            ID: {p.id.substring(0, 12)}...
                          </span>
                        </div>
                        {isCurrent ? (
                          <span className="badge-active-player">
                            <Check size={12} /> Active
                          </span>
                        ) : (
                          <span className="btn-select-profile">Select</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeModal;
