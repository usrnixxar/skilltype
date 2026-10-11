import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Gift, RotateCw } from 'lucide-react';
import { PlayerProfile } from '../utils/playerProfile';
import { ADMIN_PLAYER_ID, giftImageUrl } from '../utils/adminApi';
import { WheelStatus, wheelRequest } from '../utils/wheelApi';

const COLORS = ['#ef4444','#f97316','#f59e0b','#16a34a','#0891b2','#4f46e5','#9333ea','#db2777'];

export function SpinWheel({ open, onClose, activePlayer, claimRun, onClaimed }: {
  open:boolean; onClose:()=>void; activePlayer:PlayerProfile|null;
  claimRun:{gameSessionId:string;wave:number}|null; onClaimed:()=>void;
}) {
  const [status,setStatus]=useState<WheelStatus|null>(null);
  const isAdminTest = activePlayer?.id === ADMIN_PLAYER_ID && status?.adminTestMode === true;
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<string|null>(null);
  const [angle,setAngle]=useState(0);
  const spinTimeout=useRef<number|null>(null);
  const angleRef=useRef(0);
  useEffect(()=>()=>{if(spinTimeout.current!==null)window.clearTimeout(spinTimeout.current)},[]);
  const [spinning,setSpinning]=useState(false);
  const load=useCallback(async()=>{
    if(!activePlayer?.sessionToken)return;
    try {setStatus(await wheelRequest(activePlayer.sessionToken,'status'));setError('');}
    catch(e){setError(e instanceof Error?e.message:'Unable to load wheel');}
  },[activePlayer?.sessionToken]);
  useEffect(()=>{if(open){setStatus(null);setResult(null);void load();}},[open,load]);
  useEffect(()=>{if(!open)return;const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!spinning)onClose();};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener)},[open,onClose,spinning]);
  if(!open)return null;
  // Alternating visual order; database slot IDs and admin probabilities stay unchanged.
  const displayOrder = [1,5,2,6,3,7,4,8];
  const slots=displayOrder.map(slot=>status?.prizes.find(p=>p.slot===slot));
  const claim=async()=>{
    if(!activePlayer?.sessionToken||!claimRun||busy)return;
    setBusy(true);setError('');
    try{await wheelRequest(activePlayer.sessionToken,'claim',claimRun);onClaimed();await load();}
    catch(e){setError(e instanceof Error?e.message:'Claim failed')}
    finally{setBusy(false)}
  };
  const spin=async()=>{
    if(!activePlayer?.sessionToken||busy||spinning)return;
    setBusy(true);setError('');setResult(null);
    try {
      const response=await wheelRequest(activePlayer.sessionToken,'spin');
      const slot=Number(response.resultSlot);
      if(!Number.isInteger(slot)||slot<1||slot>8)throw new Error('Wheel result invalid');
      const position=displayOrder.indexOf(slot);
      if(position<0)throw new Error('Unknown wheel slot');
      const target=(360-(position*45+22.5))%360;
      const current=((angleRef.current%360)+360)%360;
      const distance=((target-current+360)%360);
      const nextAngle=angleRef.current+360*6+distance;
      angleRef.current=nextAngle;
      setSpinning(true);
      setAngle(nextAngle);
      const prizeTitle=status?.prizes.find(p=>p.slot===slot)?.title||'Try Again';
      if(spinTimeout.current!==null)window.clearTimeout(spinTimeout.current);
      spinTimeout.current=window.setTimeout(()=>{
        spinTimeout.current=null;
        setSpinning(false);
        setResult(prizeTitle);
        void load();
      },6000);
    }catch(e){setError(e instanceof Error?e.message:'Spin failed')}
    finally{setBusy(false)}
  };
  return <div className="spin-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!spinning)onClose();}}>
   <section role="dialog" aria-modal="true" aria-label="SkillType Spin Wheel" className="spin-modal">
    <button className="spin-close" aria-label="Close Spin Wheel" disabled={spinning} onClick={onClose}><X size={21}/></button>
    <h2>🎡 SKILLTYPE SPIN WHEEL</h2>
    <p className="spin-note">{isAdminTest ? 'Admin Test Mode — Unlimited spins, no student tokens used.' : 'Cross 10 waves to claim 1 spin token. Maximum 3 tokens per student per day (IST).'}</p>
    {!isAdminTest && <p className="spin-token-count">Available: <strong>{status?.available??'–'}</strong> / Earned today: <strong>{status?.earnedToday??'–'}/3</strong></p>}
    <div className="spin-wheel-stage">
      <div className="spin-pointer">▼</div>
      <div className="spin-wheel-disc" style={{transform:`rotate(${angle}deg)`,background:`conic-gradient(${COLORS.map((c,i)=>`${c} ${i*45}deg ${(i+1)*45}deg`).join(',')})`}}>
        {slots.map((p,i)=><div className="spin-wheel-slot" key={i} style={{transform:`rotate(${i*45+22.5}deg) translateY(calc(-1 * var(--spin-slot-radius, 104px))) rotate(${-(i*45+22.5)}deg)`}}>
         {p?.image_path&&<img src={giftImageUrl(p.image_path)} alt="" draggable={false}/>}
         <span>{p?.title||'Try Again'}</span>
        </div>)}
        <div className="spin-wheel-hub"><Gift size={20}/></div>
      </div>
    </div>
    {error&&<p role="alert" className="spin-error">{error}</p>}
    {result&&<p role="status" className="spin-result">{result==='Try Again'?'Try Again — Better luck next time!':`🎉 You won: ${result}`}</p>}
    {claimRun&&<button className="spin-primary" disabled={busy||spinning||!status||status.remainingEarnable<=0} onClick={()=>void claim()}>{busy?'Processing…':'Claim Spin for 10+ Waves'}</button>}
    <button className="spin-primary" disabled={busy||spinning||(!status?.available&&!isAdminTest)} onClick={()=>void spin()}><RotateCw size={16}/>{spinning?'Spinning…':'SPIN NOW'}</button>
    <p className="spin-disclaimer">Results are selected by the server. Spin animation is for display only.</p>
   </section>
  </div>;
}
