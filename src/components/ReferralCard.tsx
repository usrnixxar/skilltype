import { useState } from 'react';
import { Copy, Link, Users } from 'lucide-react';
import { PlayerProfile } from '../utils/playerProfile';

export function ReferralCard({ player }: { player: PlayerProfile | null }) {
  const [message, setMessage] = useState('');
  const code = player?.id || '';
  const invite = new URL('/', window.location.origin);
  if (code) invite.searchParams.set('ref', code);
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage('Copied! Share it with your friends.'); }
    catch { setMessage('Copy unavailable. Select and copy the link below.'); }
  };
  return <section className="referral-card" aria-label="Refer and earn">
    <h3><Users size={19} /> REFER &amp; EARN</h3><p>Invite friends to SkillType</p>
    {player ? <><div className="referral-code"><input aria-label="Your referral code" value={code} readOnly onFocus={e => e.target.select()} /><button type="button" aria-label="Copy referral code" onClick={() => void copy(code)}><Copy size={16} /></button></div>
      <button className="referral-invite" type="button" onClick={() => void copy(invite.href)}><Link size={16} /> Copy Invite Link</button>
      {message && <><small role="status">{message}</small><input className="referral-link" aria-label="Your invite link" value={invite.href} readOnly onFocus={e => e.target.select()} /></>}
    </> : <p>Log in to get your invite link.</p>}
    <small>Rewards to be announced</small>
  </section>;
}
