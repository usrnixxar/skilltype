import React, { useState } from 'react';
import { Play, RotateCcw, Home, Sliders } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface PauseOverlayProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onReturnToMenu: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  isOpen,
  onResume,
  onRestart,
  onOpenSettings,
  onReturnToMenu,
}) => {
  const [confirmAction, setConfirmAction] = useState<'restart' | 'menu' | null>(null);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop pause-backdrop" role="dialog" aria-modal="true" aria-label="Game Paused">
        <div className="modal-panel pause-panel">
          <div className="pause-header">
            <h2 className="pause-title">GAME PAUSED</h2>
            <p className="pause-subtitle">Systems on standby. Press ESC or Resume to re-engage.</p>
          </div>

          <div className="pause-buttons-list">
            <button className="btn btn-primary btn-lg" onClick={onResume}>
              <Play size={20} />
              <span>Resume Battle (ESC)</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setConfirmAction('restart')}
            >
              <RotateCcw size={18} />
              <span>Restart Mission</span>
            </button>

            <button className="btn btn-secondary" onClick={onOpenSettings}>
              <Sliders size={18} />
              <span>Settings</span>
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => setConfirmAction('menu')}
            >
              <Home size={18} />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationModal
        isOpen={confirmAction === 'restart'}
        title="Restart Mission?"
        message="Your current wave progress, score, and combo multiplier for this run will be lost."
        confirmLabel="Restart"
        isDestructive={true}
        onConfirm={() => {
          setConfirmAction(null);
          onRestart();
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmationModal
        isOpen={confirmAction === 'menu'}
        title="Abandon Mission?"
        message="Are you sure you want to return to the Main Menu? Your active run will be ended."
        confirmLabel="Exit to Menu"
        isDestructive={true}
        onConfirm={() => {
          setConfirmAction(null);
          onReturnToMenu();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
};
