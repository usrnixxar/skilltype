import { useEffect,useState } from 'react';
import { adminRequest } from '../utils/adminApi';

type Period='daily'|'weekly'|'monthly';
interface Funnel {days:number;visitors:number;registered:number;firstGame:number;returnedNextDay:number;eligibleForReturn:number;trackingNote:string}
interface Visit{visitor_id:string;visit_day:string}
interface Detail{profile:{id:string;name:string;kind:string;created_at:string;email?:string|null};online:boolean;lastSeen:string|null;recentActivity:string[];loginHistory:string[]}
const formatTime=(s:string|null)=>s?new Date(s).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}):'No active session recorded';
export function AnalyticsPanel({token}:{token:string}){
 const [visits,setVisits]=useState<Visit[]>([]);
 const [period,setPeriod]=useState<Period>('daily');
 const [error,setError]=useState('');
 const [funnelDays,setFunnelDays]=useState(30);
 const [funnel,setFunnel]=useState<Funnel|null>(null);
 const [funnelError,setFunnelError]=useState('');
 useEffect(()=>{let active=true;setFunnel(null);setFunnelError('');adminRequest(token,'funnel',{days:funnelDays}).then(r=>{if(active)setFunnel(r.funnel)}).catch(e=>{if(active)setFunnelError(e.message)});return()=>{active=false}},[token,funnelDays]);
 useEffect(()=>{let active=true;adminRequest(token,'analytics').then(r=>{if(active)setVisits(r.visits||[])}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[token]);
 const dates=Array.from({length:period==='daily'?14:period==='weekly'?12:6},(_,i)=>{
  const date=new Date();date.setHours(12,0,0,0);
  if(period==='daily')date.setDate(date.getDate()-(13-i));
  else if(period==='weekly')date.setDate(date.getDate()-7*(11-i));
  else date.setMonth(date.getMonth()-(5-i),1);
  const day=date.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  return {date,day,label:period==='daily'?date.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):period==='weekly'?'Week '+(i+1):date.toLocaleDateString('en-IN',{month:'short',year:'2-digit'})};
 });
 const groups=dates.map(({date,label,day})=>{
  const rangeStart=period==='daily'?day:period==='weekly'?new Date(date.getTime()-(date.getDay()*86400000)).toISOString().slice(0,10):day.slice(0,7)+'-01';
  const rangeEnd=period==='daily'?day:period==='weekly'?new Date(new Date(rangeStart+'T12:00:00').getTime()+6*86400000).toISOString().slice(0,10):new Date(Date.UTC(date.getFullYear(),date.getMonth()+1,0)).toISOString().slice(0,10);
  return {label,count:new Set(visits.filter(v=>v.visit_day>=rangeStart&&v.visit_day<=rangeEnd).map(v=>v.visitor_id)).size};
 });
 const max=Math.max(1,...groups.map(g=>g.count));
 const steps=funnel?[{label:'Website Visitors',number:funnel.visitors,detail:'Unique browser IDs'},{label:'Registered Users',number:funnel.registered,detail:'Student + registered Guest accounts'},{label:'First Game Played',number:funnel.firstGame,detail:'At least one saved game'},{label:'Returned Next Day',number:funnel.returnedNextDay,detail:'Login or game on next IST day'}]:[];
 const percent=(n:number,d:number)=>d>0?(100*n/d).toFixed(1)+'%':'—';
 return <div className="admin-analytics-layout">
 <section className="admin-surface"><div className="admin-section-heading"><div><h2>Visitor → Player Conversion Funnel</h2><p>Track the journey from website visit to next-day return.</p></div><select aria-label="Conversion period" value={funnelDays} onChange={e=>setFunnelDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div>
 {funnelError&&<p role="alert" className="admin-alert">{funnelError}</p>}
 {!funnel&&!funnelError&&<p>Loading conversion funnel…</p>}
 {funnel&&<><div className="admin-funnel-grid">{steps.map((step,i)=><article className="admin-funnel-step" key={step.label}><span className="admin-funnel-index">{i+1}</span><h3>{step.label}</h3><strong>{step.number.toLocaleString('en-IN')}</strong><small>{step.detail}</small>{i>0&&<p>{i===1?'Indicative visitor conversion':i===2?'Registration → First game':'Eligible first-game users → Next-day return'}: <b>{i===1?percent(step.number,steps[0].number):i===2?percent(step.number,steps[1].number):percent(step.number,funnel.eligibleForReturn)}</b></p>}</article>)}</div><p className="admin-funnel-caption">{funnel.trackingNote} Only users whose first game was before today can qualify for next-day return.</p></>}
 </section>
 <section className="admin-surface"><div className="admin-section-heading"><div><h2>Unique Website Visitors</h2><p>Counts unique browser IDs, not verified individuals. Tracking started after this feature was enabled.</p></div><select aria-label="Analytics period" value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
 {error&&<p role="alert" className="admin-alert">{error}</p>}
 <div className="analytics-bars" role="img" aria-label={period+' unique visitor counts'}>
 {groups.map((g,i)=><div key={i} className="analytics-bar-col"><strong>{g.count}</strong><div className="analytics-bar-track"><div className="analytics-bar" style={{height:(g.count/max*100)+'%'}}/></div><small>{g.label}</small></div>)}
 </div></section></div>;
}
export function PlayerDetail({token,playerId,onClose}:{token:string;playerId:string;onClose:()=>void}){
 const [detail,setDetail]=useState<Detail|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const load=()=>{adminRequest(token,'player-detail',{playerId}).then(r=>{if(active)setDetail(r)}).catch(e=>{if(active)setError(e.message)})};load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer)}},[token,playerId]);
 return <div className="admin-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-label="Player activity" className="admin-surface admin-detail-modal"><button className="admin-button" onClick={onClose}>Close</button><h2>{detail?.profile.name||'Player Details'}</h2>
 {error&&<p role="alert">{error}</p>}
 {detail&&<><p>Account type: {detail.profile.kind}</p>{detail.profile.email&&<p>Registered email: {detail.profile.email}</p>}<p><span className={'activity-dot '+(detail.online?'online':'offline')}/> {detail.online?'Online':'Offline'}</p><p>Account created: {formatTime(detail.profile.created_at)}</p><p>Last active: {formatTime(detail.lastSeen)}</p><h3>Login history (IST)</h3>{detail.loginHistory?.length?detail.loginHistory.map((x,i)=><p key={'login'+i}>{formatTime(x)}</p>):<p>No historical login events recorded yet.</p>}<h3>Recent activity</h3><p>Exact historical login times were not previously recorded. The following are recorded session activity timestamps.</p>{detail.recentActivity.map((x,i)=><p key={i}>{formatTime(x)}</p>)}<p>PINs/passwords are not displayed. Use a credential-reset workflow to change access.</p></>}
 </section></div>
}
