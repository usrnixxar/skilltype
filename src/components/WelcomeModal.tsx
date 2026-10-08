import React, { useState, useEffect } from 'react';
import { PlayerProfile, validatePlayerName } from '../utils/playerProfile';
import { loginPlayer } from '../utils/playerSession';
import { GraduationCap, User, Play } from 'lucide-react';
interface WelcomeModalProps {
  isOpen: boolean;
  activePlayer: PlayerProfile | null;
  onSavePlayerAndStart: (profile: PlayerProfile) => void;
  onClose?: () => void;
  canClose?: boolean;
}
export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, activePlayer, onSavePlayerAndStart }) => {
  const [kind, setKind] = useState<'student' | 'guest' | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isOpen) { setKind(null); setName(''); setPin(''); setError(''); } }, [isOpen]);
  if (!isOpen || activePlayer) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !kind) return;
    const result = validatePlayerName(name);
    if (!result.valid) { setError(result.error || 'Enter your name'); return; }
    if (kind === 'student' && !/^\d{6}$/.test(pin)) { setError('Enter your 6-digit student PIN'); return; }
    setBusy(true); setError('');
    try { onSavePlayerAndStart(await loginPlayer(kind, result.trimmedName, pin)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login failed. Please retry.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div className="modal-content welcome-modal-content">
      <div className="welcome-modal-header">
        <div className="welcome-brand-badge"><div className="welcome-logo-circle"><img src="/skillence-logo.jpg" alt="SkillType Starfighter" /></div><span className="welcome-badge-text">SKILLENCE ACADEMY</span></div>
        <h2 className="welcome-title" id="welcome-title">Choose your login</h2>
        <p className="welcome-subtitle">One profile at a time. Log out to change player.</p>
      </div>
      <div className="login-choices" aria-label="Login type">
        <button type="button" aria-pressed={kind === 'student'} className={`login-choice ${kind === 'student' ? 'selected' : ''}`} disabled={busy} onClick={() => { setKind('student'); setError(''); }}><GraduationCap size={24} /><strong>Student</strong><small>Name + 6-digit PIN</small></button>
        <button type="button" aria-pressed={kind === 'guest'} className={`login-choice ${kind === 'guest' ? 'selected' : ''}`} disabled={busy} onClick={() => { setKind('guest'); setPin(''); setError(''); }}><User size={24} /><strong>Guest</strong><small>Name only</small></button>
      </div>
      {kind && <form onSubmit={submit} className="welcome-form">
        <div className="form-group"><label htmlFor="player-name-input" className="form-label">Your full name</label>
          <input id="player-name-input" className="text-input player-name-input" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={25} required disabled={busy} autoComplete="name" placeholder="Enter your name" autoFocus />
        </div>
        {kind === 'student' && <div className="form-group"><label htmlFor="student-pin" className="form-label">Student PIN</label>
          <input id="student-pin" className="text-input player-name-input" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required disabled={busy} placeholder="6-digit PIN from your teacher" autoComplete="off" />
          <p className="form-hint">Use the same name and PIN each time. Your PIN appears on the leaderboard.</p></div>}
        <p className="form-hint">{kind === 'guest' ? 'Guest profiles show “Not a student”.' : 'Your full registered name is shown publicly and your scores stay linked to your student profile.'}</p>
        {error && <div className="form-error-msg" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary btn-welcome-start" disabled={busy}><Play size={18} /><span>{busy ? 'Checking…' : 'Log in & Play'}</span></button>
      </form>}
    </div>
  </div>;
};
export default WelcomeModal;
