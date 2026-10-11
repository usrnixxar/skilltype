import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, validatePlayerName } from '../utils/playerProfile';
import { loginPlayer, registerGuest, SessionConflictError } from '../utils/playerSession';
import { GraduationCap, User, Play } from 'lucide-react';
interface WelcomeModalProps {
  isOpen: boolean;
  activePlayer: PlayerProfile | null;
  onSavePlayerAndStart: (profile: PlayerProfile) => void;
  onClose?: () => void;
  canClose?: boolean;
}
export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, activePlayer, onSavePlayerAndStart }) => {
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
  const [kind, setKind] = useState<'student' | 'guest' | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [email,setEmail]=useState('');
  const [registerMode,setRegisterMode]=useState(false);
  const [error, setError] = useState('');
  const [notice,setNotice]=useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isOpen) { setKind(null); setName(''); setPin('');setEmail('');setRegisterMode(false); setError('');setNotice(''); } }, [isOpen]);
  if (!isOpen || activePlayer) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !kind) return;
    const result = validatePlayerName(name);
    if (!result.valid) { setError(result.error || 'Enter your name'); return; }
    if (kind === 'student' && !/^\d{6}$/.test(pin)) { setError('Enter your 6-digit student PIN'); return; }
    setBusy(true); setError('');setNotice('');
    try {
      if(kind==='guest'&&registerMode){
        await registerGuest(result.trimmedName,email,pin);
        setRegisterMode(false);setNotice('Registered successfully. Now log in with your name and PIN.');
        return;
      }
      onSavePlayerAndStart(await loginPlayer(kind, result.trimmedName, pin));
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
      setBusy(false);
    }
  };
  return <div ref={dialogRef} className="modal-backdrop welcome-screen" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'));
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div className="modal-content welcome-modal-content">
      <div className="welcome-modal-header">
        <div className="welcome-brand-badge"><div className="welcome-logo-circle"><img src="/skillence-logo.jpg" alt="SkillType Starfighter" /></div><span className="welcome-badge-text">SKILLENCE ACADEMY</span></div>
        <h2 className="welcome-title" id="welcome-title">Choose your login</h2>
        <p className="welcome-subtitle">One profile at a time. Log out to change player.</p>
      </div>
      <div className="login-choices" aria-label="Login type">
        <button type="button" aria-pressed={kind === 'student'} className={`login-choice ${kind === 'student' ? 'selected' : ''}`} disabled={busy} onClick={() => { setKind('student'); setError(''); }}><GraduationCap size={24} /><strong>Student</strong><small>Name + 6-digit PIN</small></button>
        <button type="button" aria-pressed={kind === 'guest'} className={`login-choice ${kind === 'guest' ? 'selected' : ''}`} disabled={busy} onClick={() => { setKind('guest'); setPin(''); setError(''); }}><User size={24} /><strong>Guest</strong><small>Name + PIN</small></button>
      </div>
      {kind && <form onSubmit={submit} className="welcome-form">
        <div className="form-group"><label htmlFor="player-name-input" className="form-label">Your full name</label>
          <input id="player-name-input" className="text-input player-name-input" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={25} required disabled={busy} autoComplete="name" placeholder="Enter your name" autoFocus />
        </div>
        {kind==='guest'&&registerMode&&<div className="form-group"><label className="form-label" htmlFor="guest-email">Email address</label><input id="guest-email" className="text-input player-name-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy} autoComplete="email" placeholder="Enter your email" /></div>}
        <div className="form-group"><label htmlFor="student-pin" className="form-label">{kind==='student'?'Student PIN':registerMode?'Set PIN':'Guest PIN'}</label>
          <input id="student-pin" className="text-input player-name-input" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required disabled={busy} placeholder={kind==='student'?'6-digit PIN from your teacher':registerMode?'Create a 6-digit PIN':'Your 6-digit PIN'} autoComplete={registerMode?'new-password':'off'} />
          {kind==='guest'&&registerMode&&<button type="button" className="btn" disabled={busy} onClick={()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);setPin(String(100000+a[0]%900000));}}>Generate PIN</button>}
          <p className="form-hint">Use your registered name and six-digit PIN. Keep your PIN private.</p></div>
        <p className="form-hint">{kind === 'guest' ? 'Register once with full name, email and PIN. Then log in with the same name and PIN. Names remain masked on the leaderboard.' : 'Your full registered name is shown publicly and your scores stay linked to your student profile.'}</p>
        {notice&&<div className="form-hint" role="status">{notice}</div>}
        {error && <div className="form-error-msg" role="alert">{error}</div>}
        {kind==='guest'&&!registerMode ? <div className="welcome-guest-actions">
          <button type="submit" className="btn btn-primary btn-welcome-start" disabled={busy}><Play size={18}/><span>{busy?'Checking…':'Login'}</span></button>
          <button type="button" className="btn btn-primary btn-welcome-start" disabled={busy} onClick={()=>{setRegisterMode(true);setError('');setNotice('');setPin('');}}>Register</button>
        </div> : <button type="submit" className="btn btn-primary btn-welcome-start" disabled={busy}><Play size={18}/><span>{busy?'Checking…':kind==='guest'?'Register':'Log in & Play'}</span></button>}
      </form>}
      <div className="welcome-admin-link"><a href="/admin">Admin login</a></div>
    </div>
  </div>;
};
export default WelcomeModal;
