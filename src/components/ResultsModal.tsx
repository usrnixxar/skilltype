import { RotateCcw, Home, Sparkles, AlertCircle } from 'lucide-react';
import { GameStats } from '../game/types';
import { Difficulty, GameMode } from '../utils/storage';

interface ResultsModalProps {
  isOpen: boolean;
  stats: GameStats;
  mode: GameMode;
  difficulty: Difficulty;
  isNewPersonalBest: boolean;
  onPlayAgain: () => void;
  onReturnToMenu: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  isOpen,
  stats,
  mode,
  difficulty,
  isNewPersonalBest,
  onPlayAgain,
  onReturnToMenu,
}) => {
  if (!isOpen) return null;

  // Format Duration mm:ss
  const totalSeconds = Math.max(1, Math.floor(stats.activePlayTimeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Keystrokes & Accuracy
  const totalKeys = stats.correctKeystrokes + stats.incorrectKeystrokes;
  const accuracyNum = totalKeys > 0 ? Math.round((stats.correctKeystrokes / totalKeys) * 100) : 0;
  const accuracyStr = totalKeys > 0 ? `${accuracyNum}%` : '—';

  // Average WPM
  const activeMinutes = stats.activePlayTimeMs / 60000;
  const wpmVal =
    activeMinutes > 0.05 && stats.correctKeystrokes > 0
      ? Math.round((stats.correctKeystrokes / 5) / activeMinutes)
      : 0;
  const wpmStr = wpmVal > 0 ? `${wpmVal}` : '—';

  // Most frequently mistyped letters (sorted descending)
  const mistypedEntries = Object.entries(stats.mistypedLetters)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="results-title">
      <div className="modal-panel results-panel">
        {/* Banner */}
        <div className="results-header">
          {isNewPersonalBest && (
            <div className="new-pb-badge">
              <Sparkles size={16} />
              <span>NEW PERSONAL BEST!</span>
            </div>
          )}
          <h2 id="results-title" className="results-title">
            {mode === 'arcade' ? 'MISSION DEBRIEF' : 'PRACTICE COMPLETE'}
          </h2>
          <p className="results-subtitle">
            Sector {difficulty.toUpperCase()} • Mode: {mode.toUpperCase()}
          </p>
        </div>

        {/* Grand Score Display */}
        <div className="results-score-card">
          <span className="results-score-label">FINAL SCORE</span>
          <div className="results-score-number">{stats.score.toLocaleString()}</div>
        </div>

        {/* Core Metrics Grid */}
        <div className="results-metrics-grid">
          <div className="metric-box">
            <span className="metric-label">AVERAGE WPM</span>
            <div className="metric-value text-cyan">{wpmStr}</div>
          </div>

          <div className="metric-box">
            <span className="metric-label">ACCURACY</span>
            <div className="metric-value text-green">{accuracyStr}</div>
          </div>

          <div className="metric-box">
            <span className="metric-label">WAVE REACHED</span>
            <div className="metric-value">{stats.wave}</div>
          </div>

          <div className="metric-box">
            <span className="metric-label">WORDS COMPLETED</span>
            <div className="metric-value">{stats.wordsCompleted}</div>
          </div>

          <div className="metric-box">
            <span className="metric-label">BEST COMBO</span>
            <div className="metric-value text-gold">x{stats.bestCombo}</div>
          </div>

          <div className="metric-box">
            <span className="metric-label">ACTIVE COMBAT TIME</span>
            <div className="metric-value">{timeFormatted}</div>
          </div>
        </div>

        {/* Keystrokes Breakdown */}
        <div className="results-keystrokes-row">
          <div className="keystroke-stat">
            <span className="k-dot correct-dot" />
            <span className="k-label">Correct Keystrokes:</span>
            <span className="k-num">{stats.correctKeystrokes.toLocaleString()}</span>
          </div>
          <div className="keystroke-stat">
            <span className="k-dot incorrect-dot" />
            <span className="k-label">Mistyped Keystrokes:</span>
            <span className="k-num">{stats.incorrectKeystrokes.toLocaleString()}</span>
          </div>
        </div>

        {/* Mistyped Keys Breakdown */}
        {mistypedEntries.length > 0 && (
          <div className="mistyped-analysis-box">
            <div className="mistyped-title">
              <AlertCircle size={15} />
              <span>Target Keys Requiring Focus:</span>
            </div>
            <div className="mistyped-pills-row">
              {mistypedEntries.map(([letter, count]) => (
                <div key={letter} className="mistyped-pill">
                  <span className="key-char">{letter}</span>
                  <span className="key-count">{count} {count === 1 ? 'miss' : 'misses'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="results-actions">
          <button className="btn btn-secondary" onClick={onReturnToMenu}>
            <Home size={18} />
            <span>Main Menu</span>
          </button>
          <button className="btn btn-primary btn-lg" onClick={onPlayAgain}>
            <RotateCcw size={18} />
            <span>Deploy Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
