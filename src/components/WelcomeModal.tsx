import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, validatePlayerName } from '../utils/playerProfile';
import { loginPlayer, SessionConflictError } from '../utils/playerSession';
import { GraduationCap, User, Eye, EyeOff, Crown, Zap, Trophy, Gift, Keyboard, ShieldCheck, ArrowRight, Volume2, VolumeX } from 'lucide-react';
interface WelcomeModalProps {
  isOpen: boolean;
  activePlayer: PlayerProfile | null;
  onSavePlayerAndStart: (profile: PlayerProfile) => void;
  onClose?: () => void;
  canClose?: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}
export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, activePlayer, onSavePlayerAndStart, isMuted, onToggleMute }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const visible = isOpen && !activePlayer;
  useEffect(() => {
    if (!visible) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = bodyOverflow; document.documentElement.style.overflow = htmlOverflow; };
  }, [visible]);
  const [kind, setKind] = useState<'student' | 'guest' | null>('student');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin,setShowPin]=useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isOpen) { setKind('student'); setName(''); setPin('');setShowPin(false); setError(''); } }, [isOpen]);
  if (!isOpen || activePlayer) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !kind) return;
    const result = validatePlayerName(name);
    if (!result.valid) { setError(result.error || 'Enter your name'); return; }
    if (kind === 'student' && !/^\d{6}$/.test(pin)) { setError('Enter your 6-digit student PIN'); return; }
    setBusy(true); setError('');
    try {
      onSavePlayerAndStart(await loginPlayer(kind, result.trimmedName, pin));
      setName('');
    } catch (err) {
      if (err instanceof SessionConflictError) {
        const confirmed = window.confirm(
          'This Student ID is already logged in on another device.\n\nPress OK to log out that device and continue on this device.'
        );

        if (confirmed) {
          try {
            onSavePlayerAndStart(
              await loginPlayer(kind, result.trimmedName, pin, true)
            );
          } catch (forceError) {
            setError(
              forceError instanceof Error
                ? forceError.message
                : 'Unable to switch device. Please retry.'
            );
          }
        } else {
          setError('Login cancelled. Your other device is still logged in.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Login failed. Please retry.');
      }
    } finally {
      setPin('');setShowPin(false);
      setBusy(false);
    }
  };
  return <div ref={dialogRef} className="modal-backdrop welcome-screen skilltype-landing" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'));
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div className="landing-stars" aria-hidden="true" />
    <div className="landing-shell">
      <header className="landing-navbar">
        <button type="button" className="landing-sound-toggle" onClick={onToggleMute} aria-label={isMuted ? "Unmute sound" : "Mute sound"} aria-pressed={isMuted} title={isMuted ? "Unmute sound" : "Mute sound"}>{isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}<span>{isMuted ? "Sound Off" : "Sound On"}</span></button>
        <div className="landing-logo"><img src="/skillence-logo-transparent.png" alt="Skillence Academy" className="landing-brand-image"/><span className="landing-powered-name">SkillType</span></div>
        <span className="landing-navbar-caption">TYPE • PRACTICE • COMPETE • EARN</span>
        <span className="landing-nav-pill"><Keyboard size={18}/> PLAY <span>•</span> PRACTICE <span>•</span> EARN</span>
      </header>
      <main className="landing-main">
        <section className="landing-hero">
          <span className="landing-eyebrow">A TYPING GAME FOR A BRIGHTER TOMORROW</span>
          <h1 id="welcome-title" className="landing-heading"><Crown aria-hidden="true" className="landing-heading-crown"/>Skill<span>Type</span></h1>
          <h2 className="landing-tagline">Type Fast. Play Smart. <em>Win Rewards.</em></h2>
          <p className="landing-description">Improve your typing speed, challenge your friends, climb the leaderboard, and unlock your potential — all while having fun!</p>
          <div className="landing-benefits">
            <div className="landing-benefit"><Zap size={26}/><div><strong>Improve WPM</strong><small>Type faster. Get better.</small></div></div>
            <div className="landing-benefit"><Trophy size={26}/><div><strong>Leaderboard</strong><small>Compete. Climb higher.</small></div></div>
            <div className="landing-benefit landing-benefit-gold"><Gift size={26}/><div><strong>Weekly Rewards</strong><small>Play more. Earn more.</small></div></div>
          </div>
          <div className="landing-illustration" aria-hidden="true">
            <div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/>
            <div className="landing-key key-one">A</div><div className="landing-key key-two">S</div><div className="landing-key key-three">D</div><div className="landing-key key-four">F</div>
            <div className="landing-keyboard-glow"><Keyboard size={138} strokeWidth={1.1}/></div>
          </div>
        </section>
        <aside className="landing-login-area">
          <div className="modal-content welcome-modal-content landing-login-panel">
            <div className="landing-panel-head"><span className="landing-panel-icon"><Crown size={18}/></span><div><strong>WELCOME TO SKILLTYPE</strong><small>Choose how you want to play</small></div></div>
            <div className="login-choices" aria-label="Login type">
              <button type="button" aria-pressed={kind === 'student'} className={`login-choice ${kind === 'student' ? 'selected' : ''}`} disabled={busy} onClick={() => { setKind('student'); setError(''); }}><GraduationCap size={21}/><strong>Student Login</strong></button>
              <button type="button" aria-pressed={kind === 'guest'} className={`login-choice ${kind === 'guest' ? 'selected' : ''}`} disabled={busy} onClick={() => { setKind('guest'); setPin(''); setError(''); }}><User size={21}/><strong>Guest Login</strong></button>
            </div>
            <form autoComplete="off" onSubmit={submit} className="welcome-form">
              <div className="form-group"><label htmlFor="player-name-input" className="form-label"><User size={16}/> {kind === 'student' ? 'Registered student name' : 'Your name'}</label>
                <input id="player-name-input" className="text-input player-name-input" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={25} required disabled={busy} autoComplete="off" placeholder={kind === 'student' ? 'Enter your registered name' : 'Enter your name'} />
              </div>
              {kind === 'student' && <div className="form-group"><label htmlFor="student-pin" className="form-label"><ShieldCheck size={16}/> Student PIN</label>
                <div className="welcome-pin-field"><input id="student-pin" className="text-input player-name-input" type={showPin ? "text" : "password"} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\\D/g, ''))} required disabled={busy} placeholder="Enter your 6-digit PIN" autoComplete="off" data-lpignore="true" data-1p-ignore="true" />
                  <button type="button" className="welcome-pin-toggle" onClick={() => setShowPin(v => !v)} aria-label={showPin ? 'Hide PIN' : 'Show PIN'} aria-pressed={showPin}>{showPin ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                </div>
              </div>}
              <p className="landing-form-note">{kind === 'guest' ? 'Guest login needs only your name. Guest names are masked on the leaderboard.' : 'Use your registered name and PIN. Never share your PIN with anyone.'}</p>
              {error && <div className="form-error-msg" role="alert">{error}</div>}
              <button type="submit" className="btn btn-primary btn-welcome-start" disabled={busy}><Crown size={20}/><span>{busy ? 'Checking…' : kind === 'guest' ? 'Play as Guest' : 'Login & Play'}</span><ArrowRight size={20}/></button>
            </form>
            <div className="landing-switch">{kind === 'student' ? 'New here?' : 'Already a student?'} <button type="button" disabled={busy} onClick={() => {setKind(kind === 'student' ? 'guest' : 'student');setPin('');setError('');}}>{kind === 'student' ? 'Continue as Guest' : 'Student Login'} <ArrowRight size={14}/></button></div>
            <div className="landing-secure"><ShieldCheck size={15}/> Fast login • Secure access • Start playing instantly</div>
          </div>
          <div className="landing-preview">
            <div className="landing-preview-head"><Trophy size={19}/><strong>THE TYPING ARENA</strong></div>
            <div className="landing-preview-features"><span>20 WAVES</span><span>LIVE LEADERBOARD</span><span>WEEKLY WINNERS</span></div>
            <p>Master your keyboard. Rise through the ranks.</p>
          </div>
        </aside>
      </main>
      <footer className="landing-footer"><span>POWERED BY SKILLENCE ACADEMY</span><span>LEARN • PLAY • IMPROVE</span></footer>
    </div>
  </div>;
};
export default WelcomeModal;
