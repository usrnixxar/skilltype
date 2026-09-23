import React, { useRef, useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';

interface MobileInputHelperProps {
  isPlaying: boolean;
  onCharacterTyped: (char: string) => void;
}

export const MobileInputHelper: React.FC<MobileInputHelperProps> = ({
  isPlaying,
  onCharacterTyped,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detect touch capability
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(touch);
  }, []);

  const handleTapToType = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      setIsKeyboardOpen(true);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const inputElement = e.currentTarget;
    const value = inputElement.value;

    if (value && value.length > 0) {
      const lastChar = value.slice(-1);
      onCharacterTyped(lastChar);
      // Immediately reset so next character triggers another input event
      inputElement.value = '';
    }
  };

  if (!isTouchDevice && !isKeyboardOpen) {
    // Hidden input always mounted so focus can be grabbed if needed
    return (
      <input
        ref={inputRef}
        type="text"
        className="accessible-hidden-input"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
        aria-hidden="true"
        tabIndex={-1}
        onInput={handleInput}
      />
    );
  }

  return (
    <div className="mobile-typing-wrapper">
      {/* Real focusable input */}
      <input
        ref={inputRef}
        type="text"
        className="mobile-virtual-input"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
        onInput={handleInput}
        onFocus={() => setIsKeyboardOpen(true)}
        onBlur={() => setIsKeyboardOpen(false)}
        aria-label="Mobile typing input field"
      />

      {/* Floating Prompt Button if keyboard closed during play */}
      {isPlaying && !isKeyboardOpen && (
        <button
          className="btn-tap-to-type"
          onClick={handleTapToType}
          aria-label="Tap to open keyboard"
        >
          <Keyboard size={18} />
          <span>Tap to Type</span>
        </button>
      )}
    </div>
  );
};
