import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchWeeklyLeaderboard,
  LeaderboardResponse,
} from '../utils/leaderboardApi';
import { PlayerProfile } from '../utils/playerProfile';
import { subscribeToLeaderboardRealtime } from '../utils/supabaseClient';
import { getTimeUntilSaturdayReset } from '../utils/dateUtils';
import { fetchCheaters, CheaterEntry } from '../utils/playerSession';
import {
  Trophy,
  RotateCw,
  AlertCircle,
  Sparkles,
  Zap,
  Calendar,
  Clock,
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
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily'>('weekly');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetCountdown, setResetCountdown] = useState<string>('');
  const [cheaters, setCheaters] = useState<CheaterEntry[]>([]);

  // Update Saturday reset countdown timer every minute
  useEffect(() => {
    const updateCountdown = () => {
      const { formatted } = getTimeUntilSaturdayReset();
      setResetCountdown(formatted);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboard = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else if (!data) setLoading(true);

      setError(null);
      try {
        const response = await fetchWeeklyLeaderboard(
          activePlayer?.id,
          activeTab
        );
        setData(response);
      } catch (err: any) {
        console.error('[Leaderboard fetch error]:', err);
        setError('Leaderboard temporarily unavailable.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activePlayer?.id, activeTab, data]
  );

  useEffect(() => {
    const loadCheaters = () => {
      fetchCheaters().then(setCheaters).catch(() => {});
    };
    loadCheaters();
    const timer = setInterval(loadCheaters, 60000);
    return () => clearInterval(timer);
  }, [lastSavedRunId]);

  // Initial load and reload when tab, active player, or saved run changes
  useEffect(() => {
    loadLeaderboard();
  }, [activeTab, activePlayer?.id, lastSavedRunId]);

  // Realtime subscription via Supabase if available
  useEffect(() => {
    const unsubscribe = subscribeToLeaderboardRealtime(() => {
      loadLeaderboard(true);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadLeaderboard]);

  // Fallback background polling every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchWeeklyLeaderboard(activePlayer?.id, activeTab)
        .then((res) => setData(res))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [activePlayer?.id, activeTab]);

  const ADMIN_PLAYER_ID = '5c99b1c8-e130-4c27-a750-88e35362c581';
  const allEntries = data?.entries || [];
  const entries = [...allEntries]
    .sort((a, b) => {
      if (a.playerId === ADMIN_PLAYER_ID) return -1;
      if (b.playerId === ADMIN_PLAYER_ID) return 1;
      return a.rank - b.rank;
    })
    .slice(0, 10);
  const playerRankEntry = data?.playerRank || null;

  // Check if current player is in the visible list
  const isPlayerVisible = entries.some((e) => e.playerId === activePlayer?.id);
  const hasPlayerPlayed = playerRankEntry !== null;

  return (
    <div
      className="side-panel weekly-leaderboard-panel"
      aria-label="SkillType Leaderboard"
    >
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-block">
          <div className="panel-title-row">
            <Trophy size={16} className="leaderboard-trophy-icon" />
            <h2 className="panel-title">
              {activeTab === 'weekly' ? 'WEEKLY LEADERBOARD' : 'DAILY LEADERBOARD'}
            </h2>
          </div>
          <p className="panel-subtitle">
            {activeTab === 'weekly' ? (
              <span>Resets Sat 11:59 PM IST {resetCountdown ? `(${resetCountdown})` : ''}</span>
            ) : (
              <span>Today's active competitors (Asia/Kolkata)</span>
            )}
          </p>
        </div>

        <button
          type="button"
          className={`btn-refresh-leaderboard ${refreshing ? 'spinning' : ''}`}
          onClick={() => loadLeaderboard(true)}
          disabled={loading || refreshing}
          title="Refresh live leaderboard"
          aria-label="Refresh leaderboard"
        >
          <RotateCw size={14} />
        </button>
      </div>

      {/* Wave 15 Top Achievement */}
      <div className="top-achievement-wrap" aria-label="Wave 15 top achievement">
        <div className="top-achievement-box">
          <img
            src="/wave15-headset.png"
            alt="Gaming headset reward"
            className="top-achievement-image"
            draggable={false}
          />
          <div className="top-achievement-copy">
            <span className="top-achievement-kicker">TOP ACHIEVEMENT</span>
            <strong className="top-achievement-title">Complete 15 Waves to Win</strong>
            <span className="top-achievement-subtitle">Weekly &amp; Today Challenge</span>
          </div>
        </div>
      </div>

      {/* Tab Switcher: Weekly vs Today */}
      <div className="leaderboard-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'weekly'}
          className={`leaderboard-tab-btn ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('weekly');
          }}
        >
          <Calendar size={13} />
          <span>Weekly</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'daily'}
          className={`leaderboard-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('daily');
          }}
        >
          <Clock size={13} />
          <span>Today</span>
        </button>
      </div>

      {/* Saving Banner */}
      {isSavingRun && (
        <div className="leaderboard-saving-bar">
          <Zap size={14} className="saving-icon pulse" />
          <span>Updating your leaderboard rank...</span>
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
            <div className="leaderboard-loading-text">Loading leaderboard...</div>
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
        ) : allEntries.length === 0 ? (
          <div className="leaderboard-empty-state">
            <div className="empty-icon-circle">
              <Trophy size={28} />
            </div>
            <p className="empty-title">No players yet. Be the first to play!</p>
            <p className="empty-subtext">
              Complete a game to claim Rank #1 on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="leaderboard-table-container">
            {/* Table Header: # | Player | Points | WPM */}
            <div className="leaderboard-table-header">
              <span className="col-rank">#</span>
              <span className="col-player">Player</span>
              <span className="col-points">Points</span>
              <span className="col-wpm">WPM</span>
            </div>

            <div className="leaderboard-scroll-area">
              {entries.map((entry) => {
                const isCurrentPlayer = activePlayer?.id === entry.playerId;
                const isAdmin = entry.playerId === ADMIN_PLAYER_ID;
                let rankClass = '';
                let rankBadge = isAdmin ? '👑' : `${entry.rank}`;

                if (!isAdmin && entry.rank === 1) {
                  rankClass = 'rank-gold';
                  rankBadge = '🥇 1';
                } else if (!isAdmin && entry.rank === 2) {
                  rankClass = 'rank-silver';
                  rankBadge = '🥈 2';
                } else if (!isAdmin && entry.rank === 3) {
                  rankClass = 'rank-bronze';
                  rankBadge = '🥉 3';
                }

                const displayedPoints =
                  activeTab === 'daily'
                    ? (entry.dailyPoints ?? entry.points ?? 0)
                    : (entry.weeklyPoints ?? entry.points ?? 0);

                const displayedWpm = entry.bestWpm ?? entry.wpm ?? 0;

                return (
                  <div
                    key={entry.id || `${entry.playerId}_${entry.rank}`}
                    className={`leaderboard-row ${rankClass} ${
                      isCurrentPlayer ? 'current-player-row' : ''
                    }`}
                  >
                    <div className="col-rank">
                      <span className="rank-indicator">{rankBadge}</span>
                    </div>

                    <div className="col-player" title={isAdmin ? 'Admin' : (entry.player_name || entry.playerName)}>
                      <span className="player-name-text" style={isAdmin ? { display: 'inline-flex', alignItems: 'center', gap: 6 } : undefined}>
                        {isAdmin && (
                          <img
                            src="/skillence-logo.jpg"
                            alt="Admin"
                            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            draggable={false}
                          />
                        )}
                        {isAdmin ? 'Admin' : (entry.player_name || entry.playerName || (entry as any).name || 'Unnamed Player')}
                      </span>
                      {isCurrentPlayer && <span className="you-pill">YOU</span>}
                      <small className="player-enrollment">{isAdmin ? 'Admin' : (entry.playerType === 'student' ? 'Student' : 'Not a student')}</small>
                    </div>

                    <div className="col-points">
                      <span className="stat-mono-score">
                        {isAdmin ? '∞' : displayedPoints.toLocaleString()}
                      </span>
                    </div>

                    <div className="col-wpm">
                      <span className="stat-mono-highlight">{displayedWpm}</span>
                    </div>
                  </div>
                );
              })}

              {!isPlayerVisible && playerRankEntry && (
                <div className="leaderboard-row current-player-row outside-top-ten-row">
                  <div className="col-rank">
                    <span className="rank-indicator">#{playerRankEntry.rank}</span>
                  </div>
                  <div className="col-player" title={playerRankEntry.player_name || playerRankEntry.playerName}>
                    <span className="player-name-text">
                      {playerRankEntry.player_name || playerRankEntry.playerName || (playerRankEntry as any).name || 'Unnamed Player'}
                    </span>
                    <span className="you-pill">YOU</span>
                    <small className="player-enrollment">{playerRankEntry.playerType === 'student' ? 'Student' : 'Not a student'}</small>
                  </div>
                  <div className="col-points">
                    <span className="stat-mono-score">
                      {(activeTab === 'daily'
                        ? playerRankEntry.dailyPoints ?? playerRankEntry.points ?? 0
                        : playerRankEntry.weeklyPoints ?? playerRankEntry.points ?? 0
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="col-wpm">
                    <span className="stat-mono-highlight">{playerRankEntry.bestWpm ?? playerRankEntry.wpm ?? 0}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {cheaters.length > 0 && (
        <div className="cheater-section" aria-label="Anti-cheat flagged accounts">
          <div className="cheater-section-title">⚠ CHEATER SECTION</div>
          <div className="cheater-section-subtitle">Accounts detected on more than 2 network IPs</div>
          <div className="cheater-list">
            {cheaters.map((entry, index) => (
              <div className="cheater-row" key={`${entry.name}-${index}`}>
                <span className="cheater-name">{entry.name}</span>
                <span className="cheater-ip-count">{entry.distinctIpCount} IPs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Section: Highlight Current Player or Prompt to Play */}
      <div className="leaderboard-footer-section">
        {hasPlayerPlayed ? (
          <div className="leaderboard-status-hint">
            <span>
              {activeTab === 'weekly'
                ? 'Top 10 weekly players • Beat #10 to enter the leaderboard'
                : 'Top 10 today • Beat #10 to enter the leaderboard'}
            </span>
          </div>
        ) : (
          <div className="unranked-player-card">
            <div className="unranked-title-row">
              <Sparkles size={14} className="unranked-icon" />
              <span className="unranked-title">Awaiting first result</span>
            </div>
            <p className="unranked-subtext">
              {(activePlayer?.name || '')
                ? `${(activePlayer?.name || '')}, finish a game to join the leaderboard!`
                : 'Finish a game to join the leaderboard!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;
