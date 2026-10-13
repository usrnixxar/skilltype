import { TopAchievement } from './TopAchievement';
import { SpinWheel } from './SpinWheel';
import { getSupabaseClient } from '../utils/supabaseClient';
import { GiftSlider } from './GiftSlider';
import { useCompetition } from '../context/CompetitionContext';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  fetchWeeklyLeaderboard,
  LeaderboardResponse,
} from '../utils/leaderboardApi';
import { PlayerProfile } from '../utils/playerProfile';
import { subscribeToLeaderboardRealtime } from '../utils/supabaseClient';
import { getTimeUntilSaturdayReset } from '../utils/dateUtils';
import { fetchCheaters, CheaterEntry, fetchAdminPresence } from '../utils/playerSession';
import {
  Trophy,
  RotateCw,
  AlertCircle,
  Sparkles,
  Zap,
  Calendar,
  Clock,
  X,
} from 'lucide-react';

const ADMIN_PLAYER_ID = '5c99b1c8-e130-4c27-a750-88e35362c581';

interface WeeklyLeaderboardProps {
  activePlayer: PlayerProfile | null;
  lastSavedRunId?: string | null;
  isSavingRun?: boolean;
  wheelClaimRun?: {gameSessionId:string;wave:number}|null;
  onWheelClaimed?: ()=>void;
}

export const WeeklyLeaderboard: React.FC<WeeklyLeaderboardProps> = ({
  activePlayer,
  lastSavedRunId,
  isSavingRun = false,
  wheelClaimRun = null,
  onWheelClaimed = () => {},
}) => {
  const { winner, loading: winnerLoading, unavailable: winnerUnavailable } = useCompetition();
  const [wheelOpen, setWheelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily'>('weekly');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetCountdown, setResetCountdown] = useState<string>('');
  const [cheaters, setCheaters] = useState<CheaterEntry[]>([]);

  const [publicPresence,setPublicPresence]=useState<Record<string,{online:boolean;lastSeen:string|null}>>({});
  const [presenceClock,setPresenceClock]=useState(Date.now());
  useEffect(()=>{const t=window.setInterval(()=>setPresenceClock(Date.now()),30000);return()=>window.clearInterval(t)},[]);
  const visibleIds=(data?.entries||[]).map(p=>p.playerId).filter(Boolean).slice(0,50);
  const visibleKey=visibleIds.join(',');
  useEffect(()=>{
    if(!visibleKey)return;
    const client=getSupabaseClient();if(!client)return;
    let stopped=false;
    const update=async()=>{
      try{
        const {data:response,error}=await client.functions.invoke('player-session',{body:{action:'leaderboard-presence',playerIds:visibleKey.split(',')}});
        if(error||!response?.success||stopped)return;
        setPublicPresence(Object.fromEntries((response.players||[]).map((p:{id:string;online:boolean;lastSeen:string|null})=>[p.id,{online:p.online,lastSeen:p.lastSeen}])));
      }catch{/* unknown presence displayed separately */}
    };
    void update();
    const timer=window.setInterval(update,30000);
    return()=>{stopped=true;window.clearInterval(timer)};
  },[visibleKey]);
  const renderStatus=(id:string)=>{
    const state=publicPresence[id];
    if(!state)return <span className="leaderboard-status unknown">—</span>;
    if(state.online)return <span className="leaderboard-status online">Online</span>;
    if(!state.lastSeen)return <span className="leaderboard-status offline">Offline</span>;
    const mins=Math.max(0,Math.floor((presenceClock-Date.parse(state.lastSeen))/60000));
    const age=mins<1?'just now':mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:`${Math.floor(mins/1440)}d ago`;
    return <span className="leaderboard-status offline" title={new Date(state.lastSeen).toLocaleString()}>Offline · {age}</span>;
  };
  const isAdminViewer = activePlayer?.id === ADMIN_PLAYER_ID;
  const viewerSessionToken = isAdminViewer ? activePlayer?.sessionToken : undefined;
  const [presence, setPresence] = useState<{ token: string; online: Set<string> } | null>(null);

  useEffect(() => {
    setPresence(null);
    if (!viewerSessionToken) return;
    let stopped = false;
    let busy = false;
    const refreshPresence = async () => {
      if (busy) return;
      busy = true;
      try {
        const ids = await fetchAdminPresence(viewerSessionToken);
        if (!stopped) setPresence({ token: viewerSessionToken, online: new Set(ids) });
      } catch {
        // Unknown status must not be misrepresented as offline.
        if (!stopped) setPresence(null);
      } finally { busy = false; }
    };
    void refreshPresence();
    const timer = window.setInterval(refreshPresence, 15000);
    const onFocus = () => { void refreshPresence(); };
    window.addEventListener('focus', onFocus);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [viewerSessionToken]);

  const renderPresence = (playerId: string) => {
    if (!isAdminViewer || !viewerSessionToken || presence?.token !== viewerSessionToken) return null;
    const online = presence.online.has(playerId);
    return <span className={`player-presence-dot ${online ? 'is-online' : 'is-offline'}`}
      role="img" aria-label={online ? 'Online' : 'Offline'} title={online ? 'Online' : 'Offline'} />;
  };
  const flaggedNames = new Set(cheaters.map((entry) => entry.name.trim()));
  const renderPlayerName = (name: string, playerId: string) => <>
    {flaggedNames.has(name.trim()) ? (
      <span title="Flagged by anti-cheat" style={{ color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.14)', borderRadius: 4, padding: '1px 4px' }}>
        <span role="img" aria-label="Cheater caution">⚠️</span>{' '}{name}
      </span>
    ) : name}{renderPresence(playerId)}
  </>;

  const adminPreview = useRef<HTMLDialogElement>(null);

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

  const allEntries = data?.entries || [];
  const entries = allEntries
    .filter((entry) => entry.playerId !== ADMIN_PLAYER_ID)
    .sort((a, b) => a.rank - b.rank)
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
      <SpinWheel open={wheelOpen} onClose={() => setWheelOpen(false)} activePlayer={activePlayer} claimRun={wheelClaimRun} onClaimed={onWheelClaimed}/>
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-block">
          <div className="panel-title-row">
            <Trophy size={16} className="leaderboard-trophy-icon" />
            <h2 className="panel-title">
              {activeTab === 'weekly' ? 'WEEKLY LEADERBOARD' : 'DAILY LEADERBOARD'}
            </h2>
            <button type="button" className="wheel-open-button" aria-label="Open Spin Wheel" title="Spin Wheel" onClick={() => setWheelOpen(true)}><img src="/spin-wheel-transparent.svg" alt="" className="wheel-open-image" draggable={false}/>{wheelClaimRun&&<span className="wheel-ready-dot"/>}</button>
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

      <div className="leaderboard-reward-row">
        <TopAchievement />
        <GiftSlider />
      </div>
      <div className="leaderboard-winner-row">
        <section className="leaderboard-winner-card" aria-label="Last week winner">
          <span className="stat-card-label">🏆 LAST WEEK WINNER</span>
          <strong className="last-week-winner-name">{winner?.name ?? (winnerLoading ? 'Loading…' : winnerUnavailable ? 'Temporarily unavailable' : 'No winner yet')}</strong>
          <small>Highest points at Saturday close • IST</small>
        </section>
      </div>

      <div className="admin-profile-strip" aria-label="Admin profile">
        <button type="button" className="admin-profile-card"
          onClick={() => adminPreview.current?.showModal()}
          aria-label="Open admin profile image" aria-haspopup="dialog">
          <img src="/admin-profile.png" alt="Skillence Academy Admin"
            className="admin-profile-avatar" draggable={false} />
          <span className="admin-profile-meta">
            <strong className="admin-name">👑 Admin{renderPresence(ADMIN_PLAYER_ID)}</strong>
            <span className="admin-profile-subline">Skillence Academy Admin</span>
          </span>
        </button>
      </div>
      <dialog ref={adminPreview} className="admin-image-modal"
        aria-label="Admin profile image preview"
        onClick={(event) => {
          if (event.target === event.currentTarget) adminPreview.current?.close();
        }}>
        <button type="button" className="admin-image-modal-close" autoFocus
          onClick={() => adminPreview.current?.close()} aria-label="Close image preview">
          <X size={24} />
        </button>
        <img src="/admin-profile.png" alt="Skillence Academy Admin full preview"
          className="admin-image-modal-preview" draggable={false} />
      </dialog>

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
              <span className="col-status">Status</span>
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
                        {isAdmin ? 'Admin' : renderPlayerName(entry.player_name || entry.playerName || entry.name || 'Unnamed Player', entry.playerId)}
                      </span>
                      {isCurrentPlayer && <span className="you-pill">YOU</span>}
                      <small className="player-enrollment">{isAdmin ? 'Admin' : (entry.playerType === 'student' ? 'Student' : 'Not a student')}</small>
                    </div>

                    <div className="col-status">{renderStatus(entry.playerId)}</div>
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
                      {renderPlayerName(playerRankEntry.player_name || playerRankEntry.playerName || playerRankEntry.name || 'Unnamed Player', playerRankEntry.playerId)}
                    </span>
                    <span className="you-pill">YOU</span>
                    <small className="player-enrollment">{playerRankEntry.playerType === 'student' ? 'Student' : 'Not a student'}</small>
                  </div>
                  <div className="col-status">{renderStatus(playerRankEntry.playerId)}</div>
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

      {isAdminViewer && <a className="admin-console-link" href="/admin">Open Admin Panel</a>}

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
