import { isSundayPractice } from './utils/competitionClock';
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, GameEngineState } from './game/GameEngine';
import { GameConfiguration, GameStats } from './game/types';
import {
  GameMode,
  loadRecords,
  loadSettings,
  recordCompletedSession,
  saveSettings,
  UserSettings,
} from './utils/storage';
import {
  PlayerProfile,
  loadActivePlayer,
  saveActivePlayer,
  clearActivePlayer,
  generateUuid,
} from './utils/playerProfile';
import { submitGameRun, SubmitRunPayload } from './utils/leaderboardApi';
import { getTargetWPM } from './game/WaveManager';
import { WordCategory } from './data/wordLists';
import soundEngine from './audio/SoundEngine';

// Components
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MainMenu } from './components/MainMenu';
import { GameplayHUD } from './components/GameplayHUD';
import { HowToPlayModal } from './components/HowToPlayModal';
import { PauseOverlay } from './components/PauseOverlay';
import { ResultsModal } from './components/ResultsModal';
import { PracticeSetupModal } from './components/PracticeSetupModal';
import { RecordsModal } from './components/RecordsModal';
import { SettingsModal } from './components/SettingsModal';
import { useKeyboardGate } from './hooks/useKeyboardGate';
import { LiveStatsPanel } from './components/LiveStatsPanel';
import { WeeklyLeaderboard } from './components/WeeklyLeaderboard';
import { logoutPlayer, validatePlayerSession } from './utils/playerSession';
import { WelcomeModal } from './components/WelcomeModal';

export const App: React.FC = () => {
  const { isMobile, isKeyboardCheckOpen, withKeyboard, cancelKeyboardCheck, keyboardGate } = useKeyboardGate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const submittedRunIds = useRef<Set<string>>(new Set());
  const pendingProfileStartRef = useRef<GameConfiguration | null>(null);
  const retryPayloadRef = useRef<SubmitRunPayload | null>(null);
  const activeSessionIdRef = useRef<string>(generateUuid());

  // Player Profile State (Guest profile remembered in localStorage)
  const [activePlayer, setActivePlayer] = useState<PlayerProfile | null>(loadActivePlayer);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);

  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (!activePlayer || loggingOut) return;
    engineRef.current?.pause();
    setLoggingOut(true); setLogoutError('');
    try {
      await logoutPlayer(activePlayer);
      cancelKeyboardCheck();
      pendingProfileStartRef.current = null;
      retryPayloadRef.current = null;
      activeSessionIdRef.current = generateUuid();
      setActivePlayer(null); setAppState('menu'); setModalOpen('none');
      setSaveError(null); setIsSavingRun(false); setWelcomeModalOpen(true);
    } catch (error) { setLogoutError(error instanceof Error ? error.message : 'Logout failed. Please retry.'); }
    finally { setLoggingOut(false); }
  };
  useEffect(() => {
    if (!activePlayer?.sessionToken) return;

    let stopped = false;

    const forceLocalLogout = () => {
      if (stopped) return;
      engineRef.current?.reset();
      clearActivePlayer();
      cancelKeyboardCheck();
      pendingProfileStartRef.current = null;
      retryPayloadRef.current = null;
      activeSessionIdRef.current = generateUuid();
      setActivePlayer(null);
      setAppState('menu');
      setModalOpen('none');
      setSaveError(null);
      setIsSavingRun(false);
      setLogoutError('This account was logged in on another device. You have been logged out here.');
      setWelcomeModalOpen(true);
    };

    const checkSession = async () => {
      try {
        const valid = await validatePlayerSession(activePlayer);
        if (!valid) forceLocalLogout();
      } catch {
        // Temporary network errors must not log the player out.
      }
    };

    void checkSession();
    const timer = window.setInterval(checkSession, 5000);

    const checkOnFocus = () => void checkSession();
    window.addEventListener('focus', checkOnFocus);
    document.addEventListener('visibilitychange', checkOnFocus);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', checkOnFocus);
      document.removeEventListener('visibilitychange', checkOnFocus);
    };
  }, [activePlayer?.sessionToken]);

  useEffect(() => {
    const syncProfile = (event: StorageEvent) => {
      if (event.key !== 'skilltype_active_player' && event.key !== null) return;
      engineRef.current?.reset();
      cancelKeyboardCheck();
      pendingProfileStartRef.current = null; retryPayloadRef.current = null;
      activeSessionIdRef.current = generateUuid();
      setActivePlayer(loadActivePlayer()); setAppState('menu'); setModalOpen('none');
      setSaveError(null); setIsSavingRun(false); setWelcomeModalOpen(false);
    };
    window.addEventListener('storage', syncProfile);
    return () => window.removeEventListener('storage', syncProfile);
  }, []);

  // Leaderboard sync states
  const [isSavingRun, setIsSavingRun] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedRunId, setLastSavedRunId] = useState<string | null>(null);

  const saveLeaderboardRun = async (payload: SubmitRunPayload) => {
    const id = payload.gameSessionId!;
    if (submittedRunIds.current.has(id)) return;
    submittedRunIds.current.add(id);
    retryPayloadRef.current = payload;
    setSaveError(null);
    setIsSavingRun(true);
    try {
      await submitGameRun(payload);
      if (retryPayloadRef.current?.gameSessionId === id) retryPayloadRef.current = null;
      setLastSavedRunId(id);
    } catch (error) {
      submittedRunIds.current.delete(id);
      const message = error instanceof Error ? error.message : '';
      const sessionExpired =
        /please log in again|session expired|invalid session|unauthorized/i.test(message);

      if (sessionExpired) {
        clearActivePlayer();
        cancelKeyboardCheck();
        pendingProfileStartRef.current = null;
        retryPayloadRef.current = null;
        activeSessionIdRef.current = generateUuid();
        setActivePlayer(null);
        setAppState('menu');
        setModalOpen('none');
        setSaveError('Session expired. Please log in again to continue saving leaderboard points.');
        setWelcomeModalOpen(true);
        return;
      }

      if (activeSessionIdRef.current === id) {
        setSaveError('Your result is saved on this device, but has not reached the leaderboard. Please retry before leaving this screen.');
      }
    } finally {
      if (activeSessionIdRef.current === id) setIsSavingRun(false);
    }
  };

  // Persistence State
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [records, setRecords] = useState(loadRecords);

  // App Navigation & Modal States
  const [appState, setAppState] = useState<'menu' | 'gameplay'>('menu');
  const [engineState, setEngineState] = useState<GameEngineState>('idle');
  const [modalOpen, setModalOpen] = useState<
    'none' | 'how_to_play' | 'practice_setup' | 'records' | 'settings' | 'results'
  >('none');

  // Active Game State
  const [currentMode, setCurrentMode] = useState<GameMode>('arcade');
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    wave: 1,
    targetWpm: getTargetWPM(1),
    lives: 3,
    maxLives: 3,
    pulsesRemaining: 3,
    maxPulses: 3,
    comboStreak: 0,
    bestCombo: 0,
    multiplier: 1,
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
    wordsCompleted: 0,
    activePlayTimeMs: 0,
    mistypedLetters: {},
  });

  // Apply initial audio settings & start background music
  useEffect(() => {
    soundEngine.setSfxVolume(settings.sfxVolume);
    soundEngine.setMusicVolume(settings.musicVolume);
    soundEngine.setMuted(settings.isMuted);

    // Attempt starting BGM immediately
    soundEngine.startMusic();

    // Start BGM on first user interaction if browser autoplay blocked initial play
    const handleFirstGesture = () => {
      soundEngine.startMusic();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  // Update settings helper
  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      if (engineRef.current) {
        engineRef.current.updateConfig({
          reducedMotion: updated.reducedMotion,
        });
      }
      return updated;
    });
  };

  // Initialize GameEngine
  useEffect(() => {
    if (!canvasRef.current) return;

    const gameConfig: GameConfiguration = {
      mode: currentMode,
      difficulty: settings.difficulty,
      category: settings.category,
      customWords: [],
      practiceTimedMinutes: settings.practiceTimedMinutes,
      practiceRelaxed: settings.practiceRelaxed,
      practicePace: settings.practicePace,
      reducedMotion: settings.reducedMotion,
    };

    const engine = new GameEngine(canvasRef.current, gameConfig, {
      onStatsUpdate: (newStats) => {
        setStats({ ...newStats });
      },
      onStateChange: (state) => {
        setEngineState(state);
      },
      onWaveComplete: (_wave, _bonus) => {
        // Handled in engine overlay
      },
      onGameOver: async (finalStats) => {
        const activeMinutes = finalStats.activePlayTimeMs / 60000;
        const finalWpm =
          finalStats.activePlayTimeMs > 3000 && activeMinutes > 0
            ? Math.round((finalStats.correctKeystrokes / 5) / activeMinutes)
            : 0;

        const totalKeys = finalStats.correctKeystrokes + finalStats.incorrectKeystrokes;
        const finalAccuracy =
          totalKeys > 0
            ? Math.round((finalStats.correctKeystrokes / totalKeys) * 100)
            : 0;

        // Save local session record
        const { isNewPersonalBest: isPb, updatedRecords } = recordCompletedSession({
          mode: currentMode,
          difficulty: settings.difficulty,
          score: isSundayPractice() ? 0 : finalStats.score,
          wpm: finalWpm,
          accuracy: finalAccuracy,
          wave: finalStats.wave,
          wordsCompleted: finalStats.wordsCompleted,
          durationSeconds: Math.floor(finalStats.activePlayTimeMs / 1000),
        });

        setIsNewPersonalBest(isPb);
        setRecords(updatedRecords);
        setModalOpen('results');

        // Step 2 & 3: Standardize on single name getter and identity source
        const playerName = activePlayer?.name || "";
        const playerId = activePlayer?.id || "";



        if (!playerName || playerName.length < 2) {
          console.warn('Leaderboard save aborted: Player name is empty or missing. Prompting for player name.');
          setWelcomeModalOpen(true);
          return;
        }

        const sessionId = activeSessionIdRef.current || generateUuid();

        if (finalStats.score > 0 || finalStats.wordsCompleted > 0) {
          await saveLeaderboardRun({
            gameSessionId: sessionId, runId: sessionId, playerId, playerName, sessionToken: activePlayer?.sessionToken,
            wpm: finalWpm, score: isSundayPractice() ? 0 : finalStats.score, accuracy: finalAccuracy,
            wave: finalStats.wave, wordsCompleted: finalStats.wordsCompleted,
            durationSeconds: Math.floor(finalStats.activePlayTimeMs / 1000),
          });
        }

      },
    });

    engineRef.current = engine;
    engine.startLoop();
    // Saving a profile recreates the engine. Start the replacement engine,
    // not the old instance that the effect cleanup is about to destroy.
    if (pendingProfileStartRef.current) {
      engine.updateConfig(pendingProfileStartRef.current);
      cancelKeyboardCheck();
      pendingProfileStartRef.current = null;
      withKeyboard(() => {
        setAppState('gameplay');
        engine.startGame();
      });
    }

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    // ResizeObserver ensures canvas updates when container dimensions shift
    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Auto-pause when losing window focus or tab visibility
    const handleBlur = () => {
      if (engine.getState() === 'playing') {
        engine.pause();
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        if (engine.getState() === 'playing') {
          engine.pause();
        }
        soundEngine.pauseMusic();
      } else {
        if (!settings.isMuted) {
          soundEngine.resumeMusic();
        }
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      engine.destroy();
      engineRef.current = null;
    };
  }, [activePlayer]);

  // Keyboard listener for gameplay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If any modal is open or on main menu, allow normal keyboard navigation
      if (
        isKeyboardCheckOpen ||
        modalOpen !== 'none' ||
        appState !== 'gameplay' ||
        welcomeModalOpen ||
        !activePlayer
      ) {
        return;
      }

      if (isMobile && (e.isComposing || e.keyCode === 229 || !e.code || !e.isTrusted)) return;
      if (isMobile && engineRef.current?.getState() === 'paused' && e.key === 'Escape') {
        e.preventDefault();
        withKeyboard(() => engineRef.current?.resume());
        return;
      }
      if (engineRef.current) {
        engineRef.current.handleKeyDown(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, appState, welcomeModalOpen, activePlayer, isMobile, isKeyboardCheckOpen, withKeyboard]);

  // --- Actions ---

  const startArcadeGame = () => withKeyboard(() => {
    if (!activePlayer) {
      setWelcomeModalOpen(true);
      return;
    }

    activeSessionIdRef.current = generateUuid();
    setSaveError(null);
    setIsSavingRun(false);
    retryPayloadRef.current = null;
    setCurrentMode('arcade');
    setAppState('gameplay');
    setModalOpen('none');

    if (engineRef.current) {
      engineRef.current.updateConfig({
        mode: 'arcade',
        difficulty: settings.difficulty,
        category: 'common',
        practiceTimedMinutes: 0,
        practiceRelaxed: false,
        reducedMotion: settings.reducedMotion,
      });
      engineRef.current.startGame();
    }
  });

  const startPracticeGame = (practiceConfig: {
    category: WordCategory;
    customWords: string[];
    practiceTimedMinutes: number;
    practiceRelaxed: boolean;
    practicePace: 'slow' | 'normal' | 'fast';
  }) => withKeyboard(() => {
    if (!activePlayer) {
      setWelcomeModalOpen(true);
      return;
    }

    activeSessionIdRef.current = generateUuid();
    setSaveError(null);
    setIsSavingRun(false);
    retryPayloadRef.current = null;
    setCurrentMode('practice');
    setAppState('gameplay');
    setModalOpen('none');

    handleUpdateSettings({
      category: practiceConfig.category,
      practiceTimedMinutes: practiceConfig.practiceTimedMinutes,
      practiceRelaxed: practiceConfig.practiceRelaxed,
      practicePace: practiceConfig.practicePace,
      customWordsRaw: practiceConfig.customWords.join(', '),
    });

    if (engineRef.current) {
      engineRef.current.updateConfig({
        mode: 'practice',
        difficulty: settings.difficulty,
        category: practiceConfig.category,
        customWords: practiceConfig.customWords,
        practiceTimedMinutes: practiceConfig.practiceTimedMinutes,
        practiceRelaxed: practiceConfig.practiceRelaxed,
        practicePace: practiceConfig.practicePace,
        reducedMotion: settings.reducedMotion,
      });
      engineRef.current.startGame();
    }
  });

  const handlePauseToggle = () => {
    if (!engineRef.current) return;
    if (engineState === 'playing') {
      engineRef.current.pause();
    } else if (engineState === 'paused') {
      withKeyboard(() => engineRef.current?.resume());
    }
  };

  const handleRestart = () => withKeyboard(() => {
    activeSessionIdRef.current = generateUuid();
    setSaveError(null);
    setIsSavingRun(false);
    retryPayloadRef.current = null;
    setModalOpen('none');
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  });

  const handleReturnToMenu = () => {
    setModalOpen('none');
    setAppState('menu');
    if (engineRef.current) {
      engineRef.current.reset();
    }
  };

  const handleEmergencyPulse = () => {
    if (engineRef.current) {
      engineRef.current.triggerEmergencyPulse();
    }
  };

  const handleEndPractice = () => {
    if (engineRef.current && currentMode === 'practice') {
      engineRef.current.endPractice();
    }
  };

  // Current personal best for difficulty
  const pbKey = `${currentMode}_${settings.difficulty}`;
  const currentBest = records.personalBests[pbKey] || null;

  return (
    <div className="skilltype-app" id="skilltype-root">
      {/* 3-Column Desktop Layout */}
      <div className="skilltype-layout-container">
        {/* LEFT COLUMN: Live Player Statistics */}
        <aside className="skilltype-side-column skilltype-left-column">
          <LiveStatsPanel
            stats={stats}
            mode={currentMode}
            activePlayer={activePlayer}
            practiceTimedMs={
              engineRef.current ? engineRef.current.getPracticeTimeRemainingMs() : 0
            }
            isRelaxed={settings.practiceRelaxed}
            onChangePlayer={handleLogout}
            isPlaying={appState === 'gameplay' && engineState === 'playing'}
          />
        </aside>

        {/* CENTER COLUMN: Existing Typing Game */}
        <main className="skilltype-center-column">
          <div className="game-viewport-container" ref={containerRef}>
            <canvas
              ref={canvasRef}
              className="game-canvas"
              id="skilltype-canvas"
              tabIndex={-1}
              aria-label="SkillType Space Battlefield"
            />

            {/* Ambient Top Header */}
            <Header
              isPlaying={appState === 'gameplay'}
              isPaused={engineState === 'paused'}
              onPauseToggle={handlePauseToggle}
              onOpenSettings={() => setModalOpen('settings')}
              isMuted={settings.isMuted}
              onToggleMute={() => {
                const next = !settings.isMuted;
                handleUpdateSettings({ isMuted: next });
              }}
            />

            {/* Bottom In-Game HUD Controls (Shields, Pulses, End Practice) */}
            {appState === 'gameplay' && (
              <GameplayHUD
                stats={stats}
                mode={currentMode}
                practiceTimedMs={
                  engineRef.current
                    ? engineRef.current.getPracticeTimeRemainingMs()
                    : 0
                }
                isRelaxed={settings.practiceRelaxed}
                onTriggerPulse={handleEmergencyPulse}
                onEndPractice={
                  currentMode === 'practice' ? handleEndPractice : undefined
                }
              />
            )}

            {/* Main Menu Overlay */}
            {appState === 'menu' && (
              <MainMenu
                onStartArcade={startArcadeGame}
                onOpenPractice={() => {
                  if (!activePlayer) {
                    setWelcomeModalOpen(true);
                    return;
                  }
                  setModalOpen('practice_setup');
                }}
                onOpenHowToPlay={() => setModalOpen('how_to_play')}
                onOpenRecords={() => setModalOpen('records')}
                onOpenSettings={() => setModalOpen('settings')}
                difficulty={settings.difficulty}
                onChangeDifficulty={(diff) =>
                  handleUpdateSettings({ difficulty: diff })
                }
                currentBest={currentBest}
              />
            )}

            {/* Pause Overlay */}
            <PauseOverlay
              isOpen={
                appState === 'gameplay' &&
                engineState === 'paused' &&
                modalOpen === 'none'
              }
              onResume={() => withKeyboard(() => engineRef.current?.resume())}
              onRestart={handleRestart}
              onOpenSettings={() => setModalOpen('settings')}
              onReturnToMenu={handleReturnToMenu}
            />

            {/* Modals */}
            <HowToPlayModal
              isOpen={modalOpen === 'how_to_play'}
              onClose={() => setModalOpen('none')}
              onStartPlaying={startArcadeGame}
            />

            <PracticeSetupModal
              isOpen={modalOpen === 'practice_setup'}
              onClose={() => setModalOpen('none')}
              settings={settings}
              onStartPractice={startPracticeGame}
            />

            <RecordsModal
              isOpen={modalOpen === 'records'}
              onClose={() => setModalOpen('none')}
              records={records}
              onRecordsCleared={() => setRecords(loadRecords())}
            />

            <SettingsModal
              isOpen={modalOpen === 'settings'}
              onClose={() => setModalOpen('none')}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />

            <ResultsModal
              isSavingRun={isSavingRun}
              saveError={saveError}
              onRetrySave={() => { if (retryPayloadRef.current) void saveLeaderboardRun(retryPayloadRef.current); }}
              isOpen={modalOpen === 'results'}
              stats={stats}
              mode={currentMode}
              difficulty={settings.difficulty}
              isNewPersonalBest={isNewPersonalBest}
              onPlayAgain={
                currentMode === 'arcade'
                  ? startArcadeGame
                  : () => setModalOpen('practice_setup')
              }
              onReturnToMenu={handleReturnToMenu}
            />

            <Footer />
          </div>
        </main>

        {/* RIGHT COLUMN: Weekly Player Leaderboard */}
        <aside className="skilltype-side-column skilltype-right-column">
          <WeeklyLeaderboard
            activePlayer={activePlayer}
            lastSavedRunId={lastSavedRunId}
            isSavingRun={isSavingRun}
          />
        </aside>
      </div>

      {keyboardGate}
      {logoutError && <div className="session-error" role="alert">{logoutError}</div>}
      {/* Name Entry Welcome & Profile Switching Screen */}
      <WelcomeModal
        isOpen={welcomeModalOpen || !activePlayer}
        activePlayer={activePlayer}
        canClose={activePlayer !== null}
        onClose={() => setWelcomeModalOpen(false)}
        onSavePlayerAndStart={(profile) => {
          setActivePlayer(profile);
          saveActivePlayer(profile);
          setWelcomeModalOpen(false);

          // If on main menu, automatically launch arcade game
          if (appState === 'menu') {
            setCurrentMode('arcade');
            if (!isMobile) setAppState('gameplay');
            setModalOpen('none');
            activeSessionIdRef.current = generateUuid();
            setSaveError(null);
            setIsSavingRun(false);
            retryPayloadRef.current = null;
            pendingProfileStartRef.current = {
              mode: 'arcade', difficulty: settings.difficulty, category: 'common',
              customWords: [], practiceTimedMinutes: 0, practiceRelaxed: false,
              practicePace: settings.practicePace, reducedMotion: settings.reducedMotion,
            };
          }
        }}
      />
    </div>
  );
};

export default App;
