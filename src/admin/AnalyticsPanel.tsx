import { useEffect,useState } from 'react';
import { adminRequest } from '../utils/adminApi';

type Period='daily'|'weekly'|'monthly';
interface Visit{visitor_id:string;visit_day:string}
interface Detail{profile:{id:string;name:string;kind:string;created_at:string};online:boolean;lastSeen:string|null;recentActivity:string[]}
const formatTime=(s:string|null)=>s?new Date(s).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}):'No active session recorded';
export function AnalyticsPanel({token}:{token:string}){
 const [visits,setVisits]=useState<Visit[]>([]);
 const [period,setPeriod]=useState<Period>('daily');
 const [error,setError]=useState('');
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
 return <section className="admin-surface"><div className="admin-section-heading"><div><h2>Unique Website Visitors</h2><p>Counts unique browser IDs, not verified individuals. Tracking started after this feature was enabled.</p></div><select aria-label="Analytics period" value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
 {error&&<p role="alert" className="admin-alert">{error}</p>}
 <div className="analytics-bars" role="img" aria-label={period+' unique visitor counts'}>
 {groups.map((g,i)=><div key={i} className="analytics-bar-col"><strong>{g.count}</strong><div className="analytics-bar-track"><div className="analytics-bar" style={{height:(g.count/max*100)+'%'}}/></div><small>{g.label}</small></div>)}
 </div></section>;
}
export function PlayerDetail({token,playerId,onClose}:{token:string;playerId:string;onClose:()=>void}){
 const [detail,setDetail]=useState<Detail|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const load=()=>{adminRequest(token,'player-detail',{playerId}).then(r=>{if(active)setDetail(r)}).catch(e=>{if(active)setError(e.message)})};load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer)}},[token,playerId]);
 return <div className="admin-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-label="Player activity" className="admin-surface admin-detail-modal"><button className="admin-button" onClick={onClose}>Close</button><h2>{detail?.profile.name||'Player Details'}</h2>
 {error&&<p role="alert">{error}</p>}
 {detail&&<><p>Account type: {detail.profile.kind}</p><p><span className={'activity-dot '+(detail.online?'online':'offline')}/> {detail.online?'Online':'Offline'}</p><p>Account created: {formatTime(detail.profile.created_at)}</p><p>Last active: {formatTime(detail.lastSeen)}</p><h3>Recent activity</h3><p>Exact historical login times were not previously recorded. The following are recorded session activity timestamps.</p>{detail.recentActivity.map((x,i)=><p key={i}>{formatTime(x)}</p>)}<p>PINs/passwords are not displayed. Use a credential-reset workflow to change access.</p></>}
 </section></div>
}
