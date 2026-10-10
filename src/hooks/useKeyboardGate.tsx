import { useCallback, useEffect, useRef, useState } from 'react';

// Include tablets/iPad desktop mode without treating touch laptops as phones.
export function isMobileKeyboardDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function useKeyboardGate() {
  const [isMobile] = useState(isMobileKeyboardDevice);
  const [isOpen, setIsOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => {
    pending.current = null;
    setIsOpen(false);
  }, []);
  const withKeyboard = useCallback((action: () => void) => {
    if (!isMobile) { action(); return; }
    pending.current = action;
    setIsOpen(true);
  }, [isMobile]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    previous?.blur();
    panel.current?.focus();
    let shiftHeld = false;
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
      if (event.key === 'Tab') { event.preventDefault(); panel.current?.querySelector('button')?.focus(); return; }
      if (!event.isTrusted || event.repeat || event.isComposing || event.keyCode === 229) return;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') shiftHeld = true;
      if (shiftHeld && event.shiftKey && event.code === 'KeyK' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        const action = pending.current;
        pending.current = null;
        setIsOpen(false);
        action?.();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') shiftHeld = false;
    };
    const clearShift = () => { shiftHeld = false; };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', clearShift);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', clearShift);
      if (previous?.matches('input, textarea, [contenteditable]')) {
        document.getElementById('skilltype-canvas')?.focus();
      } else { previous?.focus(); }
    };
  }, [isOpen, cancel]);

  const keyboardGate = isOpen ? (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="keyboard-check-title" style={{ position: 'fixed', zIndex: 10000 }}>
      <div className="modal-panel" ref={panel} tabIndex={-1} style={{ width: 'min(440px, calc(100vw - 32px))', padding: 24 }}>
        <h2 id="keyboard-check-title">External keyboard required</h2>
        <p>Connect a Bluetooth or USB keyboard to play on your phone or tablet.</p>
        <p>Hold <strong>Shift</strong> and press <strong>K</strong> on your keyboard to start or resume.</p>
        <p>On-screen keyboard is not supported for gameplay.</p>
        <button className="btn btn-secondary" onClick={cancel}>Cancel</button>
      </div>
    </div>
  ) : null;
  return { isMobile, isKeyboardCheckOpen: isOpen, withKeyboard, cancelKeyboardCheck: cancel, keyboardGate };
}
