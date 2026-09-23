import React, { useState } from 'react';
import { X, Trophy, Trash2, Calendar, Award, History } from 'lucide-react';
import { GameRecords, clearAllRecords } from '../utils/storage';
import { ConfirmationModal } from './ConfirmationModal';

interface RecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: GameRecords;
  onRecordsCleared: () => void;
}

export const RecordsModal: React.FC<RecordsModalProps> = ({
  isOpen,
  onClose,
  records,
  onRecordsCleared,
}) => {
  const [activeTab, setActiveTab] = useState<'bests' | 'history'>('bests');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const pbEntries = Object.entries(records.personalBests);

  return (
    <>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="records-title">
        <div className="modal-panel records-panel">
          <div className="modal-header">
            <div className="modal-title-row">
              <Trophy size={22} className="text-gold" />
              <div>
                <h2 id="records-title" className="modal-title">Combat Records</h2>
                <span className="modal-badge-subtitle">Saved on this device</span>
              </div>
            </div>
            <button className="modal-close-btn" onClick={onClose} aria-label="Close Records">
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="records-nav-tabs">
            <button
              className={`records-tab-btn ${activeTab === 'bests' ? 'active' : ''}`}
              onClick={() => setActiveTab('bests')}
            >
              <Award size={16} />
              <span>Personal Bests</span>
            </button>
            <button
              className={`records-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={16} />
              <span>Recent Sessions ({records.recentSessions.length})</span>
            </button>
          </div>

          <div className="modal-body scrollable-content">
            {/* Tab 1: Personal Bests */}
            {activeTab === 'bests' && (
              <div className="bests-container">
                {pbEntries.length === 0 ? (
                  <div className="empty-records-box">
                    <p className="empty-records-text">No combat records logged yet.</p>
                    <p className="empty-records-sub">Complete an Arcade or Practice run to establish your high scores.</p>
                  </div>
                ) : (
                  <div className="pb-cards-grid">
                    {pbEntries.map(([key, pb]) => {
                      const [mode, diff] = key.split('_');
                      return (
                        <div key={key} className="pb-card">
                          <div className="pb-card-header">
                            <span className="pb-mode-badge">{mode.toUpperCase()}</span>
                            <span className="pb-diff-badge">{diff?.toUpperCase()}</span>
                          </div>
                          <div className="pb-score-large">{pb.score.toLocaleString()} pts</div>
                          <div className="pb-details-row">
                            <div className="pb-stat">
                              <span className="stat-label">WPM</span>
                              <span className="stat-val text-cyan">{pb.wpm}</span>
                            </div>
                            <div className="pb-stat">
                              <span className="stat-label">Accuracy</span>
                              <span className="stat-val text-green">{pb.accuracy}%</span>
                            </div>
                            <div className="pb-stat">
                              <span className="stat-label">Wave</span>
                              <span className="stat-val">{pb.wave}</span>
                            </div>
                          </div>
                          <div className="pb-date-footer">
                            <Calendar size={12} />
                            <span>{formatDate(pb.date)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Recent Sessions History Table */}
            {activeTab === 'history' && (
              <div className="history-container">
                {records.recentSessions.length === 0 ? (
                  <div className="empty-records-box">
                    <p className="empty-records-text">No recent session logs recorded.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Mode</th>
                          <th>Difficulty</th>
                          <th>Score</th>
                          <th>WPM</th>
                          <th>Accuracy</th>
                          <th>Wave</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.recentSessions.map((session) => (
                          <tr key={session.id}>
                            <td className="cell-date">{formatDate(session.date)}</td>
                            <td>
                              <span className={`pill-badge badge-${session.mode}`}>
                                {session.mode}
                              </span>
                            </td>
                            <td>{session.difficulty}</td>
                            <td className="cell-bold">{session.score.toLocaleString()}</td>
                            <td className="text-cyan font-mono">{session.wpm}</td>
                            <td className="text-green font-mono">{session.accuracy}%</td>
                            <td>{session.wave}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer footer-between">
            <button
              className="btn btn-ghost btn-danger-ghost"
              onClick={() => setShowClearConfirm(true)}
              disabled={pbEntries.length === 0 && records.recentSessions.length === 0}
            >
              <Trash2 size={16} />
              <span>Clear Device Records</span>
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Clear Confirmation */}
      <ConfirmationModal
        isOpen={showClearConfirm}
        title="Clear All Records?"
        message="This action will permanently remove all personal bests and history saved on this browser."
        confirmLabel="Clear Everything"
        isDestructive={true}
        onConfirm={() => {
          clearAllRecords();
          onRecordsCleared();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  );
};
