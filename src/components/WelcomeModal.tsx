import React, { useState, useEffect } from 'react';
import {
  PlayerProfile,
  validatePlayerName,
  createPlayerProfile,
  loadAllLocalPlayers,
  saveActivePlayer,
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
      if (activePlayer) {
        setName(activePlayer.name);
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
    const validation = validatePlayerName(name);

    if (!validation.valid) {
      setError(validation.error || 'Please enter a valid name (2–24 characters).');
      return;
    }

    // If the activePlayer has the exact same name and user is just continuing:
    if (activePlayer && activePlayer.name === validation.trimmedName) {
      registerPlayerWithServer(activePlayer.id, activePlayer.name);
      onSavePlayerAndStart(activePlayer);
      return;
    }

    // Otherwise, create a NEW unique guest profile for this player
    // Identical names on the same computer will NOT merge because each gets a unique ID!
    const newProfile = createPlayerProfile(validation.trimmedName);
    registerPlayerWithServer(newProfile.id, newProfile.name);
    onSavePlayerAndStart(newProfile);
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
            Welcome to SkillType
          </h2>
          <p className="welcome-subtitle">
            Enter your name and challenge the weekly leaderboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="welcome-form">
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="player-name-input" className="form-label">
                <User size={14} className="label-icon" /> Your name
              </label>
              <span className="char-counter">
                {name.length}/24
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
                maxLength={24}
                placeholder="e.g. Maverick, Alex Chen"
                autoFocus
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {error && <div className="form-error-msg">{error}</div>}

            <p className="form-hint">
              Guest profile • No password needed • 2–24 characters (spaces allowed)
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
                {showSwitchList ? 'Hide profiles' : `Switch saved player on this computer (${localProfiles.length})`}
              </span>
            </button>

            {showSwitchList && (
              <div className="shared-profiles-list">
                <div className="shared-profiles-header">
                  <span>Select student profile:</span>
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
                            ID: {p.id.substring(0, 10)}...
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
