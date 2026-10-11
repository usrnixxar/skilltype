import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { PlayerProfile } from '../utils/playerProfile';

export function ReferralCard({ player }: { player: PlayerProfile | null }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  if (!player) return null;
  const invite = new URL('/', window.location.origin);
  invite.searchParams.set('ref', player.id);
  const copy = async () => {
    try { await navigator.clipboard.writeText(invite.href); setStatus('copied'); }
    catch { setStatus('error'); }
  };
  return <section className="referral-strip" aria-label="Refer and win">
    <div className="referral-strip-row"><div className="referral-strip-text"><strong>REFER AND WIN</strong><small aria-live="polite">{status === 'copied' ? 'Invitation link copied!' : 'Copy invitation link'}</small></div>
      <button type="button" aria-label="Copy invitation link" title="Copy invitation link" onClick={() => void copy()}>{status === 'copied' ? <Check size={21} /> : <Share2 size={21} />}</button>
    </div>
    {status === 'error' && <div className="referral-copy-fallback"><small role="status">Select and copy your invitation link:</small><input aria-label="Your invitation link" value={invite.href} readOnly onFocus={e => e.target.select()} /></div>}
  </section>;
}
