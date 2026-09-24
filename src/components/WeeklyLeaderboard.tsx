import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchWeeklyLeaderboard,
  LeaderboardResponse,
} from '../utils/leaderboardApi';
import { PlayerProfile } from '../utils/playerProfile';
import {
  Trophy,
  RotateCw,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface WeeklyLeaderboardProps {
  activePlayer: PlayerProfile | null;
  lastSavedRunId?: string | null;
  isSavingRun?: boolean;
}

export const WeeklyLeaderboard: React.FC<WeeklyLeaderboardProps> = ({
  activePlayer,
  lastSavedRunId,
  isSavingRun = false,
}) => {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const response = await fetchWeeklyLeaderboard(activePlayer?.id);
      setData(response);
    } catch (err: any) {
      console.error('Failed to load weekly leaderboard:', err);
      setError('Unable to reach shared leaderboard server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePlayer?.id]);

  // Initial load and reload when active player or last saved run changes
  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard, lastSavedRunId]);

  // Polling every 30 seconds to keep shared runs up-to-date across computers
  useEffect(() => {
    const timer = setInterval(() => {
      fetchWeeklyLeaderboard(activePlayer?.id)
        .then((res) => setData(res))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [activePlayer?.id]);

  const entries = data?.entries || [];
  const playerRankEntry = data?.playerRank || null;

  // Check if current player is in the top 10 (or top visible)
  const isPlayerInTop10 = entries.slice(0, 10).some((e) => e.playerId === activePlayer?.id);
  const hasPlayerCompletedRun = playerRankEntry !== null;

  return (
    <div className="side-panel weekly-leaderboard-panel" aria-label="Weekly Player Leaderboard">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-block">
          <div className="panel-title-row">
            <Trophy size={16} className="leaderboard-trophy-icon" />
            <h2 className="panel-title">WEEKLY LEADERBOARD</h2>
          </div>
          <p className="panel-subtitle">Best runs from the last 7 days.</p>
        </div>

        <button
          type="button"
          className={`btn-refresh-leaderboard ${refreshing ? 'spinning' : ''}`}
          onClick={() => loadLeaderboard(true)}
          disabled={loading || refreshing}
          title="Refresh weekly rankings"
          aria-label="Refresh leaderboard"
        >
          <RotateCw size={14} />
        </button>
      </div>

      {/* Saving Banner */}
      {isSavingRun && (
        <div className="leaderboard-saving-bar">
          <Zap size={14} className="saving-icon pulse" />
          <span>Saving your combat record to leaderboard...</span>
        </div>
      )}

      {/* Content Area */}
      <div className="leaderboard-content-wrapper">
        {loading && !data ? (
          <div className="leaderboard-loading-state">
            <div className="leaderboard-skeleton-row" />
            <div className="leaderboard-skeleton-row" />
            <div className="leaderboard-skeleton-row" />
            <div className="leaderboard-skeleton-row" />
            <div className="leaderboard-skeleton-row" />
            <div className="leaderboard-loading-text">Loading weekly records...</div>
          </div>
        ) : error ? (
          <div className="leaderboard-error-state">
            <AlertCircle size={28} className="error-icon" />
            <p className="error-text">{error}</p>
            <button
              type="button"
              className="btn btn-sm btn-secondary btn-retry"
              onClick={() => loadLeaderboard(true)}
            >
              Retry Connection
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="leaderboard-empty-state">
            <div className="empty-icon-circle">
              <Trophy size={28} />
            </div>
            <p className="empty-title">No runs in the last 7 days.</p>
            <p className="empty-subtext">
              Be the first pilot to complete a mission and claim rank #1!
            </p>
          </div>
        ) : (
          <div className="leaderboard-table-container">
            <div className="leaderboard-table-header">
              <span className="col-rank">RANK</span>
              <span className="col-player">PLAYER</span>
              <span className="col-wpm">WPM</span>
              <span className="col-score">SCORE</span>
            </div>

            <div className="leaderboard-scroll-area">
              {entries.map((entry) => {
                const isCurrentPlayer = activePlayer?.id === entry.playerId;
                let rankClass = '';
                let rankBadge = `${entry.rank}`;

                if (entry.rank === 1) {
                  rankClass = 'rank-gold';
                  rankBadge = '🥇 1';
                } else if (entry.rank === 2) {
                  rankClass = 'rank-silver';
                  rankBadge = '🥈 2';
                } else if (entry.rank === 3) {
                  rankClass = 'rank-bronze';
                  rankBadge = '🥉 3';
                }

                return (
                  <div
                    key={entry.runId}
                    className={`leaderboard-row ${rankClass} ${
                      isCurrentPlayer ? 'current-player-row' : ''
                    }`}
                  >
                    <div className="col-rank">
                      <span className="rank-indicator">{rankBadge}</span>
                    </div>

                    <div className="col-player" title={entry.playerName}>
                      <span className="player-name-text">{entry.playerName}</span>
                      {isCurrentPlayer && <span className="you-pill">YOU</span>}
                    </div>

                    <div className="col-wpm">
                      <span className="stat-mono-highlight">{entry.wpm}</span>
                    </div>

                    <div className="col-score">
                      <span className="stat-mono-score">
                        {entry.score.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Status / Outside Top 10 or Awaiting First Result */}
      <div className="leaderboard-footer-section">
        {hasPlayerCompletedRun ? (
          !isPlayerInTop10 && playerRankEntry ? (
            // Sticky card when current player is outside the top 10
            <div className="pinned-player-card">
              <div className="pinned-label">YOUR RANK:</div>
              <div className="pinned-row">
                <span className="pinned-rank">#{playerRankEntry.rank}</span>
                <span className="pinned-name" title={playerRankEntry.playerName}>
                  {playerRankEntry.playerName} (You)
                </span>
                <span className="pinned-wpm">{playerRankEntry.wpm} WPM</span>
                <span className="pinned-score">
                  {playerRankEntry.score.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="leaderboard-status-hint">
              <ShieldCheck size={13} />
              <span>Rolling 7-day window • 1 best run per pilot</span>
            </div>
          )
        ) : (
          // Unranked section: awaiting first result
          <div className="unranked-player-card">
            <div className="unranked-title-row">
              <Sparkles size={14} className="unranked-icon" />
              <span className="unranked-title">Awaiting first result</span>
            </div>
            <p className="unranked-subtext">
              {activePlayer?.name || 'Pilot'}, finish a run to qualify for the weekly leaderboard!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
