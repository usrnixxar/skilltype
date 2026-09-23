import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { MobileInputHelper } from './components/MobileInputHelper';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

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

  // Apply initial audio settings
  useEffect(() => {
    soundEngine.setSfxVolume(settings.sfxVolume);
    soundEngine.setMusicVolume(settings.musicVolume);
    soundEngine.setMuted(settings.isMuted);
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
      onGameOver: (finalStats) => {
        // Save session record
        const { isNewPersonalBest: isPb, updatedRecords } = recordCompletedSession({
          mode: currentMode,
          difficulty: settings.difficulty,
          score: finalStats.score,
          wpm:
            finalStats.activePlayTimeMs > 3000
              ? Math.round((finalStats.correctKeystrokes / 5) / (finalStats.activePlayTimeMs / 60000))
              : 0,
          accuracy:
            finalStats.correctKeystrokes + finalStats.incorrectKeystrokes > 0
              ? Math.round(
                  (finalStats.correctKeystrokes /
                    (finalStats.correctKeystrokes + finalStats.incorrectKeystrokes)) *
                    100
                )
              : 0,
          wave: finalStats.wave,
          wordsCompleted: finalStats.wordsCompleted,
          durationSeconds: Math.floor(finalStats.activePlayTimeMs / 1000),
        });

        setIsNewPersonalBest(isPb);
        setRecords(updatedRecords);
        setModalOpen('results');
      },
    });

    engineRef.current = engine;
    engine.startLoop();

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    // Auto-pause when losing window focus or tab visibility
    const handleBlur = () => {
      if (engine.getState() === 'playing') {
        engine.pause();
      }
    };
    const handleVisibility = () => {
      if (document.hidden && engine.getState() === 'playing') {
        engine.pause();
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Keyboard listener for gameplay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If any modal (other than pause) is open or on main menu, allow normal keyboard navigation
      if (modalOpen !== 'none' || appState !== 'gameplay') {
        return;
      }

      if (engineRef.current) {
        engineRef.current.handleKeyDown(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, appState]);

  // Mobile virtual input character forwarder
  const handleCharacterTyped = useCallback((char: string) => {
    if (engineRef.current && appState === 'gameplay' && modalOpen === 'none') {
      engineRef.current.processTypingCharacter(char);
    }
  }, [appState, modalOpen]);

  // --- Actions ---

  const startArcadeGame = () => {
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
  };

  const startPracticeGame = (practiceConfig: {
    category: WordCategory;
    customWords: string[];
    practiceTimedMinutes: number;
    practiceRelaxed: boolean;
    practicePace: 'slow' | 'normal' | 'fast';
  }) => {
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
  };

  const handlePauseToggle = () => {
    if (!engineRef.current) return;
    if (engineState === 'playing') {
      engineRef.current.pause();
    } else if (engineState === 'paused') {
      engineRef.current.resume();
    }
  };

  const handleRestart = () => {
    setModalOpen('none');
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  };

  const handleReturnToMenu = () => {
    soundEngine.stopAmbientDrone();
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
      {/* Background Ambience / Canvas viewport */}
      <div className="game-viewport-container">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          id="skilltype-canvas"
          tabIndex={-1}
          aria-label="SkillType Space Battlefield"
        />

        {/* Ambient Top & Bottom Headers */}
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

        {/* Gameplay HUD when in game */}
        {appState === 'gameplay' && (
          <GameplayHUD
            stats={stats}
            mode={currentMode}
            practiceTimedMs={
              engineRef.current ? engineRef.current.getPracticeTimeRemainingMs() : 0
            }
            isRelaxed={settings.practiceRelaxed}
            onTriggerPulse={handleEmergencyPulse}
            onEndPractice={currentMode === 'practice' ? handleEndPractice : undefined}
          />
        )}

        {/* Mobile Input Helper */}
        <MobileInputHelper
          isPlaying={appState === 'gameplay' && engineState === 'playing'}
          onCharacterTyped={handleCharacterTyped}
        />

        {/* Main Menu Overlay */}
        {appState === 'menu' && (
          <MainMenu
            onStartArcade={startArcadeGame}
            onOpenPractice={() => setModalOpen('practice_setup')}
            onOpenHowToPlay={() => setModalOpen('how_to_play')}
            onOpenRecords={() => setModalOpen('records')}
            onOpenSettings={() => setModalOpen('settings')}
            difficulty={settings.difficulty}
            onChangeDifficulty={(diff) => handleUpdateSettings({ difficulty: diff })}
            currentBest={currentBest}
          />
        )}

        {/* Pause Overlay */}
        <PauseOverlay
          isOpen={appState === 'gameplay' && engineState === 'paused' && modalOpen === 'none'}
          onResume={() => engineRef.current?.resume()}
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
          isOpen={modalOpen === 'results'}
          stats={stats}
          mode={currentMode}
          difficulty={settings.difficulty}
          isNewPersonalBest={isNewPersonalBest}
          onPlayAgain={currentMode === 'arcade' ? startArcadeGame : () => setModalOpen('practice_setup')}
          onReturnToMenu={handleReturnToMenu}
        />

        <Footer />
      </div>
    </div>
  );
};

export default App;
