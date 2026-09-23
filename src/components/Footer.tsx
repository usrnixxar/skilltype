import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="skilltype-footer" role="contentinfo">
      <div className="footer-content">
        <span className="footer-credit">
          A typing experience by{' '}
          <span className="footer-logo-circle">
            <img src="/skillence-logo.jpg" alt="" className="footer-logo-img" />
          </span>{' '}
          <strong className="credit-name">Skillence Academy</strong>
        </span>
        <span className="footer-sep">•</span>
        <span className="footer-controls-hint">Desktop Keyboard recommended • [ESC] Pause • [SPACE] Pulse</span>
      </div>
    </footer>
  );
};
