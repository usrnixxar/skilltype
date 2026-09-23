import React, { useState } from 'react';
import { X, BookOpen, Heart, CheckCircle2 } from 'lucide-react';
import { WordCategory, normalizeCustomWords } from '../data/wordLists';
import { UserSettings } from '../utils/storage';

interface PracticeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onStartPractice: (practiceSettings: {
    category: WordCategory;
    customWords: string[];
    practiceTimedMinutes: number;
    practiceRelaxed: boolean;
    practicePace: 'slow' | 'normal' | 'fast';
  }) => void;
}

export const PracticeSetupModal: React.FC<PracticeSetupModalProps> = ({
  isOpen,
  onClose,
  settings,
  onStartPractice,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<WordCategory>(settings.category || 'common');
  const [relaxedMode, setRelaxedMode] = useState<boolean>(settings.practiceRelaxed ?? true);
  const [timedMinutes, setTimedMinutes] = useState<number>(settings.practiceTimedMinutes || 0);
  const [pace, setPace] = useState<'slow' | 'normal' | 'fast'>(settings.practicePace || 'normal');
  const [customText, setCustomText] = useState<string>(settings.customWordsRaw || '');

  if (!isOpen) return null;

  // Real-time custom word evaluation
  const { validWords, rejectedCount } = normalizeCustomWords(customText);

  const handleLaunch = () => {
    onStartPractice({
      category: selectedCategory,
      customWords: validWords,
      practiceTimedMinutes: timedMinutes,
      practiceRelaxed: relaxedMode,
      practicePace: pace,
    });
  };

  const categories: { id: WordCategory; label: string; desc: string }[] = [
    {
      id: 'common',
      label: 'Common English',
      desc: 'Balanced everyday vocabulary for fluid typing cadence.',
    },
    {
      id: 'coding',
      label: 'Computer Terminology',
      desc: 'Algorithms, data structures, cloud, systems, and protocols.',
    },
    {
      id: 'htmlcss',
      label: 'HTML & CSS Vocabulary',
      desc: 'Selectors, layout properties, keyframes, DOM, and responsive web terms.',
    },
    {
      id: 'business',
      label: 'Business & Office',
      desc: 'Project management, corporate finance, meetings, and strategy.',
    },
    {
      id: 'custom',
      label: 'Custom Word List',
      desc: 'Paste your own text, code snippets, or custom drills.',
    },
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="practice-title">
      <div className="modal-panel practice-panel">
        <div className="modal-header">
          <div className="modal-title-row">
            <BookOpen size={22} className="text-cyan" />
            <h2 id="practice-title" className="modal-title">Practice Flight Deck</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close Practice Setup">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body scrollable-content">
          {/* 1. Category Selection */}
          <div className="setup-section">
            <label className="setup-label">TRAINING VOCABULARY</label>
            <div className="category-cards-grid">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-card ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <div className="cat-card-header">
                    <span className="cat-name">{cat.label}</span>
                    {selectedCategory === cat.id && <CheckCircle2 size={16} className="text-cyan" />}
                  </div>
                  <p className="cat-desc">{cat.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 1.1 Custom Words Input Box */}
          {selectedCategory === 'custom' && (
            <div className="setup-section custom-words-section">
              <div className="custom-input-header">
                <label className="setup-label" htmlFor="custom-words-input">PASTE CUSTOM WORDS OR PHRASES</label>
                <div className="custom-stats-badge">
                  <span className="valid-count">{validWords.length} words accepted</span>
                  {rejectedCount > 0 && (
                    <span className="rejected-count">({rejectedCount} filtered)</span>
                  )}
                </div>
              </div>
              <textarea
                id="custom-words-input"
                className="custom-words-textarea"
                rows={4}
                placeholder="Paste words separated by commas, spaces, or lines (e.g. quantum, hyperspace, nebula, velocity)..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
              <p className="custom-help-text">
                Accepts 3–15 character words (English letters a–z). Numbers and punctuation are automatically normalized.
              </p>
            </div>
          )}

          {/* 2. Practice Mode Controls */}
          <div className="setup-grid-2">
            {/* Survival Mode */}
            <div className="setup-section">
              <label className="setup-label">SURVIVAL CONDITIONS</label>
              <div className="toggle-button-group">
                <button
                  className={`toggle-option ${relaxedMode ? 'active' : ''}`}
                  onClick={() => setRelaxedMode(true)}
                >
                  <Heart size={16} />
                  <span>Relaxed (Infinite Lives)</span>
                </button>
                <button
                  className={`toggle-option ${!relaxedMode ? 'active' : ''}`}
                  onClick={() => setRelaxedMode(false)}
                >
                  <Heart size={16} />
                  <span>Standard (3 Lives)</span>
                </button>
              </div>
            </div>

            {/* Timed Session */}
            <div className="setup-section">
              <label className="setup-label">SESSION DURATION</label>
              <div className="duration-pill-group">
                {[
                  { val: 0, label: 'Untimed' },
                  { val: 1, label: '1 Min' },
                  { val: 3, label: '3 Min' },
                  { val: 5, label: '5 Min' },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`duration-pill ${timedMinutes === item.val ? 'active' : ''}`}
                    onClick={() => setTimedMinutes(item.val)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Starting Pace */}
          <div className="setup-section">
            <label className="setup-label">STARTING VELOCITY</label>
            <div className="pace-pill-group">
              {[
                { id: 'slow', label: 'Cruising (Slow)', desc: 'Ideal for accuracy practice' },
                { id: 'normal', label: 'Standard (Normal)', desc: 'Balanced speed' },
                { id: 'fast', label: 'Overdrive (Fast)', desc: 'High-speed reflex test' },
              ].map((p) => (
                <button
                  key={p.id}
                  className={`pace-card ${pace === p.id ? 'active' : ''}`}
                  onClick={() => setPace(p.id as 'slow' | 'normal' | 'fast')}
                >
                  <span className="pace-title">{p.label}</span>
                  <span className="pace-desc">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleLaunch}
            disabled={selectedCategory === 'custom' && validWords.length === 0}
          >
            Launch Practice
          </button>
        </div>
      </div>
    </div>
  );
};
