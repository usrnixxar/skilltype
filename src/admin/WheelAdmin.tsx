import { useEffect, useState } from 'react';
import { adminRequest, giftImageUrl, imageAsBase64 } from '../utils/adminApi';

interface Prize { slot:number; title:string; image_path:string|null; chance:number; }
function SlotEditor({ prize, token, onSaved }: {prize:Prize;token:string;onSaved:()=>void}) {
 const [title,setTitle]=useState(prize.title);
 const [chance,setChance]=useState(String(prize.chance));
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try {
   const image=file?await imageAsBase64(file):undefined;
   await adminRequest(token,'wheel-save',{slot:prize.slot,title:title.trim(),chance:Number(chance),...(image?{image}:{})});
   setFile(null);onSaved();
  }catch(e){setError(e instanceof Error?e.message:'Save failed')}finally{setBusy(false)}
 };
 return <form className="admin-surface wheel-slot-editor" onSubmit={save}>
  <h3>Prize Slot {prize.slot-4}</h3>
  {prize.image_path&&<img src={giftImageUrl(prize.image_path)} alt={prize.title} style={{width:100,height:90,objectFit:'contain'}}/>}
  <label>Product name<input value={title} maxLength={80} required onChange={e=>setTitle(e.target.value)}/></label>
  <label>Chance (%)<input type="number" min="0" max="100" step="0.01" required value={chance} onChange={e=>setChance(e.target.value)}/></label>
  <label>Product image (JPG, PNG, WebP; max 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  {error&&<p className="admin-alert" role="alert">{error}</p>}
  <button type="submit" className="admin-primary" disabled={busy}>{busy?'Saving…':'Save prize'}</button>
 </form>;
}
export function WheelAdmin({token}:{token:string}) {
 const [prizes,setPrizes]=useState<Prize[]>([]);
 const [error,setError]=useState('');
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  adminRequest(token,'wheel-prizes').then(r=>{if(!cancelled)setPrizes(r.prizes||[])}).catch(e=>{if(!cancelled)setError(e.message)});
  return()=>{cancelled=true};
 },[token,version]);
 const total=prizes.filter(p=>p.slot>4&&p.image_path).reduce((sum,p)=>sum+Number(p.chance),0);
 return <section>
  <div className="admin-surface"><h2>🎡 Spin Wheel Manager</h2>
    <p>4 Try Again segments + 4 editable prize segments. Enter the percentage chance for each prize. The remaining chance is shared by Try Again.</p>
    <p><strong>Product chance: {total.toFixed(2)}%</strong> · Try Again chance: {Math.max(0,100-total).toFixed(2)}%</p>
    <p>Students earn one claim after crossing 10 waves in a scored game, up to 3 tokens per day (IST).</p>
    {error&&<p className="admin-alert" role="alert">{error}</p>}
  </div>
  <div className="admin-gift-grid">{prizes.filter(p=>p.slot>4).map(p=><SlotEditor key={p.slot+'-'+p.title+'-'+p.chance+'-'+p.image_path} prize={p} token={token} onSaved={()=>setVersion(n=>n+1)}/>)}</div>
 </section>;
}