import { X, Target } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPlaying: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  isOpen,
  onClose,
  onStartPlaying,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="how-to-play-title">
      <div className="modal-panel how-to-play-panel">
        <div className="modal-header">
          <div className="modal-title-row">
            <Target size={22} className="text-cyan" />
            <h2 id="how-to-play-title" className="modal-title">Combat Protocol: How to Play</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close Guide">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body scrollable-content">
          {/* Visual Step-by-Step Cards */}
          <div className="guide-cards-grid">
            {/* Step 1 */}
            <div className="guide-card">
              <div className="guide-step-badge">STEP 1</div>
              <div className="guide-visual-box">
                <div className="visual-enemy-demo">
                  <div className="demo-ship scout-ship">▲</div>
                  <div className="demo-label">
                    <span className="demo-char-active">F</span>
                    <span className="demo-char-rest">IRE</span>
                  </div>
                </div>
              </div>
              <h4 className="guide-step-title">Acquire Target</h4>
              <p className="guide-step-desc">
                Enemy starships descend with word labels. Press the <strong>first letter</strong> of any enemy to lock onto it.
              </p>
            </div>

            {/* Step 2 */}
            <div className="guide-card">
              <div className="guide-step-badge">STEP 2</div>
              <div className="guide-visual-box">
                <div className="visual-enemy-demo targeted">
                  <div className="demo-reticle">⛶</div>
                  <div className="demo-label targeted-label">
                    <span className="demo-char-typed">F</span>
                    <span className="demo-char-active">I</span>
                    <span className="demo-char-rest">RE</span>
                  </div>
                </div>
              </div>
              <h4 className="guide-step-title">Finish the Word</h4>
              <p className="guide-step-desc">
                Your ship locks aim automatically. Type each subsequent character to fire plasma lasers and disintegrate the craft.
              </p>
            </div>

            {/* Step 3 */}
            <div className="guide-card">
              <div className="guide-step-badge">STEP 3</div>
              <div className="guide-visual-box">
                <div className="visual-danger-demo">
                  <div className="demo-danger-line" />
                  <div className="demo-shields-row">
                    <span className="shield-icon active">🛡️</span>
                    <span className="shield-icon active">🛡️</span>
                    <span className="shield-icon lost">🛡️</span>
                  </div>
                </div>
              </div>
              <h4 className="guide-step-title">Guard the Perimeter</h4>
              <p className="guide-step-desc">
                Do not let enemies cross the bottom red danger line. Each breach depletes <strong>1 shield</strong>. 3 breaches ends the run!
              </p>
            </div>

            {/* Step 4 */}
            <div className="guide-card">
              <div className="guide-step-badge">TACTICAL</div>
              <div className="guide-visual-box">
                <div className="visual-pulse-demo">
                  <div className="demo-pulse-ring" />
                  <span className="demo-pulse-key">SPACE</span>
                </div>
              </div>
              <h4 className="guide-step-title">Emergency Pulse</h4>
              <p className="guide-step-desc">
                Trapped? Tap <strong>SPACE</strong> or the Pulse button to unleash an EMP shockwave that wipes all active enemies. (3 per run).
              </p>
            </div>
          </div>

          {/* Enemy Classification Guide */}
          <div className="guide-intel-section">
            <h4 className="intel-title">Enemy Fleet Classifications</h4>
            <div className="intel-fleet-row">
              <div className="intel-ship-item">
                <div className="intel-ship-icon scout-color">◆</div>
                <div className="intel-ship-info">
                  <span className="intel-name">Scout Drone</span>
                  <span className="intel-desc">3–4 letter words • Moderate speed • Straight trajectory</span>
                </div>
              </div>

              <div className="intel-ship-item">
                <div className="intel-ship-icon fighter-color">▶</div>
                <div className="intel-ship-info">
                  <span className="intel-name">Winged Fighter</span>
                  <span className="intel-desc">5–7 letter words • Evasive lateral sway • Wave 2+</span>
                </div>
              </div>

              <div className="intel-ship-item">
                <div className="intel-ship-icon heavy-color">⬢</div>
                <div className="intel-ship-info">
                  <span className="intel-name">Heavy Dreadnought</span>
                  <span className="intel-desc">8+ letter words • Shield ring • High score bonus • Wave 4+</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Key Bindings */}
          <div className="guide-keys-strip">
            <div className="key-item"><kbd>A</kbd>–<kbd>Z</kbd> <span>Target & Type</span></div>
            <div className="key-item"><kbd>SPACE</kbd> <span>Emergency EMP</span></div>
            <div className="key-item"><kbd>ESC</kbd> <span>Pause / Resume</span></div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onStartPlaying}>Engage Combat</button>
        </div>
      </div>
    </div>
  );
};
