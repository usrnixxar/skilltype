import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gift, Trophy, LogOut, Search, ShieldCheck, Trash2, Upload, Users } from 'lucide-react';
import { loadActivePlayer, PlayerProfile, clearActivePlayer } from '../utils/playerProfile';
import { loginPlayer, logoutPlayer, SessionConflictError } from '../utils/playerSession';
import { adminRequest, GiftSlide, giftImageUrl, imageAsBase64, ManagedPlayer } from '../utils/adminApi';
import './admin.css';
import { WheelAdmin } from './WheelAdmin';
import { AnalyticsPanel, PlayerDetail } from './AnalyticsPanel';

function GiftEditor({ gift, token, onSaved, onError }: { gift: GiftSlide; token: string; onSaved: () => void; onError: (error: string) => void }) {
  const [title, setTitle] = useState(gift.title);
  const [enabled, setEnabled] = useState(gift.enabled);
  const [busy, setBusy] = useState(false);
  const save = async (remove = false) => {
    if (busy) return;
    if (remove && !window.confirm(`Remove “${gift.title}” and its image permanently?`)) return;
    setBusy(true); onError('');
    try {
      await adminRequest(token, remove ? 'delete-gift' : 'update-gift', { id: gift.id, title, enabled, sortOrder: gift.sort_order });
      onSaved();
    } catch (e) { onError(e instanceof Error ? e.message : 'Could not save gift.'); }
    finally { setBusy(false); }
  };
  return <article className="admin-gift-card">
    <div className="admin-gift-preview"><img src={giftImageUrl(gift.image_path)} alt={gift.title} /></div>
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>Gift title<input aria-label={`Title for ${gift.title}`} value={title} maxLength={80} required disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
      <div className="admin-gift-options"><label className="admin-checkbox"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => setEnabled(e.target.checked)} /> {gift.section === 'achievement' ? 'Show as Top Achievement' : 'Show in showcase'}</label></div>
      <div className="admin-actions"><button className="admin-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button className="admin-danger" type="button" disabled={busy} onClick={() => void save(true)}><Trash2 size={16} /> Delete</button></div>
    </form>
  </article>;
}

export default function AdminPage() {
  const [profile, setProfile] = useState<PlayerProfile | null>(loadActivePlayer);
  const token = profile?.sessionToken || '';
  const [verifiedToken, setVerifiedToken] = useState('');
  const authorized = !!token && verifiedToken === token;
  const [checking, setChecking] = useState(!!token);
  const [name, setName] = useState(''); const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'players' | 'showcase' | 'achievement' | 'wheel' | 'analytics'>('analytics');
  const [players, setPlayers] = useState<ManagedPlayer[]>([]); const [total, setTotal] = useState(0);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false); const [revision, setRevision] = useState(0);
  const [gifts, setGifts] = useState<GiftSlide[]>([]);
  const [selectedPlayerId,setSelectedPlayerId] = useState<string|null>(null);
  const [deleting, setDeleting] = useState<ManagedPlayer | null>(null); const [confirmation, setConfirmation] = useState('');
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null); const [title, setTitle] = useState('');
  const uploadId = useRef(crypto.randomUUID());
  const [preview, setPreview] = useState(''); const fileInput = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => setRevision(r => r + 1), []);

  useEffect(() => {
    setVerifiedToken(''); setPlayers([]); setGifts([]); setDeleting(null);
    if (!token) { setChecking(false); return; }
    let stopped = false; setChecking(true);
    const check = async () => {
      try { await adminRequest(token, 'auth'); if (!stopped) { setVerifiedToken(token); setError(''); } }
      catch (e) { if (!stopped) { setVerifiedToken(''); setError(e instanceof Error ? e.message : 'Admin access unavailable'); } }
      finally { if (!stopped) setChecking(false); }
    };
    void check(); const timer = window.setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [token]);
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === 'skilltype_active_player' || e.key === null) setProfile(loadActivePlayer()); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!authorized || tab === 'wheel' || tab === 'analytics') return;
    let stopped = false; setLoading(true); setError('');
    const load = async () => {
      try {
        const result = await adminRequest(token, tab === 'players' ? 'players' : 'gifts', tab === 'players' ? { search, page } : {});
        if (stopped) return;
        if (tab === 'players') { setPlayers(result.players); setTotal(result.total); }
        else setGifts(result.gifts);
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Could not load data.'); }
      finally { if (!stopped) setLoading(false); }
    };
    void load(); return () => { stopped = true; };
  }, [authorized, token, tab, page, search, revision]);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (deleting && authorized) deleteDialog.current?.showModal(); else deleteDialog.current?.close(); }, [deleting, authorized]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      let next: PlayerProfile;
      try { next = await loginPlayer('student', name.trim(), pin); }
      catch (e) {
        if (!(e instanceof SessionConflictError) || !window.confirm('Your account is logged in on another device. Log out that device and continue here?')) throw e;
        next = await loginPlayer('student', name.trim(), pin, true);
      }
      setProfile(next); setName(''); setPin('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Login failed.'); }
    finally { setPin(''); setBusy(false); }
  };
  const logout = async () => {
    if (!profile || busy) return; setBusy(true); setError('');
    try { await logoutPlayer(profile); clearActivePlayer(); setProfile(null); setVerifiedToken(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Logout failed.'); }
    finally { setBusy(false); }
  };
  const deletePlayer = async () => {
    if (!deleting || confirmation !== 'DELETE' || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await adminRequest(token, 'delete-player', { playerId: deleting.id, confirm: confirmation });
      setNotice(`Deleted ${deleting.name} and their saved scores.`); setDeleting(null); setConfirmation('');
      if (players.length === 1 && page > 0) setPage(p => p - 1); else refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed.'); }
    finally { setBusy(false); }
  };
  const upload = async (event: React.FormEvent) => {
    event.preventDefault(); if (!file || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const image = await imageAsBase64(file);
      await adminRequest(token, 'upload-gift', { id: uploadId.current, title: title.trim(), image, section: tab });
      setNotice(tab === 'achievement' ? 'Product uploaded. Select Show as Top Achievement and save to display it.' : 'Product published in the shuffled showcase.');
      uploadId.current = crypto.randomUUID(); setTitle(''); setFile(null); if (fileInput.current) fileInput.current.value = ''; refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); }
  };
  return <main className="admin-root"><div className="admin-shell">
    <header className="admin-header"><a className="admin-brand" href="https://skilltype.vercel.app/"><img src="/skillence-logo.jpg" alt="Skillence Academy" /><span>SkillType<small>ADMIN CONSOLE</small></span></a>
      <div className="admin-actions"><a className="admin-button" href="https://skilltype.vercel.app/"><ArrowLeft size={16} /> Back to game</a>{profile && <button className="admin-button" disabled={busy} onClick={() => void logout()}><LogOut size={16} /> Log out</button>}</div></header>
    {error && <div className="admin-alert" role="alert">{error}</div>}
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {!authorized ? <section className="admin-login admin-surface"><ShieldCheck size={36} className="admin-accent" /><h1>Admin login</h1><p>Manage players and gifts for SkillType.</p>
      {checking ? <p role="status">Checking admin access…</p> : profile ? <><p>This account does not currently have verified Admin access. Log out to use your Admin account, or retry the connection.</p><button className="admin-button" onClick={() => window.location.reload()}>Retry</button></> : <form autoComplete="off" onSubmit={login}>
        <label>Registered admin name<input value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={25} autoComplete="off" required disabled={busy} placeholder="Your existing registered name" /></label>
        <label>Admin PIN<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} autoComplete="off" data-lpignore="true" data-1p-ignore="true" required disabled={busy} placeholder="Your existing 6-digit PIN" /></label>
        <button type="submit" className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to Admin'}</button><p className="admin-muted">Only the existing Admin account can manage this website.</p>
      </form>}
    </section> : <>
      <div className="admin-page-heading"><div><p className="admin-eyebrow">SKILLENCE ACADEMY</p><h1>Website management</h1><p>Welcome, {profile?.name}. Manage players and the public gift showcase.</p></div><span className="admin-verified"><ShieldCheck size={16} /> Admin verified</span></div>
      <nav className="admin-tabs" aria-label="Admin sections"><button className={tab === 'analytics' ? 'active' : ''} onClick={()=>setTab('analytics')}>📊 Analytics Dashboard</button><button className={tab === 'players' ? 'active' : ''} aria-current={tab === 'players' ? 'page' : undefined} onClick={() => { setTab('players'); setNotice(''); }}><Users size={18} /> Players</button>{(['achievement', 'showcase'] as const).map(section => <button key={section} disabled={busy} className={tab === section ? 'active' : ''} aria-current={tab === section ? 'page' : undefined} onClick={() => { setTab(section); setFile(null); setTitle(''); uploadId.current = crypto.randomUUID(); if (fileInput.current) fileInput.current.value = ''; setNotice(''); }}>{section === 'achievement' ? <Trophy size={18} /> : <Gift size={18} />}{section === 'achievement' ? 'Top Achievement' : 'Showcase'}</button>)}<button className={tab === 'wheel' ? 'active' : ''} onClick={() => {setTab('wheel');setNotice('')}}>🎡 Spin Wheel</button></nav>
      {tab === 'analytics' ? <AnalyticsPanel token={token}/> : tab === 'wheel' ? <WheelAdmin token={token} /> : tab === 'players' ? <section className="admin-surface"><div className="admin-section-heading"><div><h2>Players <span className="admin-count">{total}</span></h2><p>Search by name or player ID. Your Admin account is protected.</p></div><button className="admin-button" onClick={refresh} disabled={loading}>Refresh</button></div>
        <form className="admin-search" onSubmit={e => { e.preventDefault(); setPage(0); setSearch(query.trim()); }}><Search size={18} /><input aria-label="Search players" placeholder="Search player name or ID…" maxLength={80} value={query} onChange={e => setQuery(e.target.value)} /><button type="submit" className="admin-primary">Search</button></form>
        {loading ? <p role="status">Loading players…</p> : players.length === 0 ? <div className="admin-empty">No players found.</div> : <div className="admin-table-wrap"><table><thead><tr><th>Player</th><th>Student ID</th><th>Type</th><th>All-time points</th><th>Action</th><th>Submitted Email</th></tr></thead><tbody>{players.map(player => <tr key={player.id}><td><button type="button" className="admin-player-detail-button" onClick={()=>setSelectedPlayerId(player.id)}><strong>{player.name}</strong></button></td><td><small className="admin-player-id">{player.id}</small></td><td><span className={'activity-dot '+(player.online?'online':'offline')} title={player.online?'Online':'Offline'} aria-label={player.online?'Online':'Offline'}/><span className="admin-type">{player.kind}</span></td><td>{Number(player.points).toLocaleString()}</td><td><button type="button" className="admin-danger" onClick={() => { setDeleting(player); setConfirmation(''); setError(''); }}><Trash2 size={15} /> Delete</button></td><td>{player.email || "—"}</td></tr>)}</tbody></table></div>}
        <div className="admin-pagination"><button className="admin-button" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1,Math.ceil(total / 25))}</span><button className="admin-button" disabled={(page + 1) * 25 >= total || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
      </section> : <section><div className="admin-surface"><div className="admin-section-heading"><div><h2>{tab === 'achievement' ? 'Top Achievement product' : 'Showcase products'}</h2><p>{tab === 'achievement' ? 'Upload products one at a time. Choose one product to display above the leaderboard.' : 'Upload multiple products one at a time. Visible products shuffle below the leaderboard.'} JPG, PNG or WebP · up to 2 MB.</p></div><Upload size={24} className="admin-accent" /></div>
        <form className="admin-upload-form" onSubmit={upload}><label>Gift title<input value={title} required maxLength={80} placeholder="e.g. Gaming Keyboard" disabled={busy} onChange={e => setTitle(e.target.value)} /></label><label>Gift image<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} onChange={e => { uploadId.current = crypto.randomUUID(); setFile(e.target.files?.[0] || null); }} /></label>
          {preview && <img className="admin-upload-preview" src={preview} alt="Selected gift preview" />}<button className="admin-primary" type="submit" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload product'}</button></form>
      </div><div className="admin-section-heading admin-gifts-heading"><h2>{tab === 'achievement' ? 'Achievement library' : 'Showcase library'}</h2><button className="admin-button" onClick={refresh} disabled={loading}>Refresh</button></div><p className="admin-muted">{tab === 'achievement' ? 'Only one product can be active. Selecting a new product automatically hides the previous selection.' : 'All visible products rotate in random order. Hide a product to keep it in your library without displaying it.'}</p>
        {loading ? <p role="status">Loading gifts…</p> : gifts.filter(gift => gift.section === tab).length === 0 ? <div className="admin-surface admin-empty">No gifts uploaded yet. Upload your first image above.</div> : <div className="admin-gift-grid">{gifts.filter(gift => gift.section === tab).map(gift => <GiftEditor key={`${gift.id}:${gift.title}:${gift.enabled}:${gift.sort_order}`} gift={gift} token={token} onError={setError} onSaved={() => { refresh(); setNotice('Product display updated.'); }} />)}</div>}
      </section>}
      {selectedPlayerId && <PlayerDetail token={token} playerId={selectedPlayerId} onClose={()=>setSelectedPlayerId(null)}/>}
      <dialog ref={deleteDialog} className="admin-delete-dialog" onCancel={e => { if (busy) e.preventDefault(); else setDeleting(null); }}><h2>Delete this player?</h2><strong>{deleting?.name}</strong><small className="admin-player-id">{deleting?.id}</small><p>This permanently removes the profile, all leaderboard scores and game history, and logs out this player.</p>{deleting?.kind === 'student' && <p>The student PIN will also be disabled.</p>}<p>A guest can still join again as a new guest.</p>
        <label>Type DELETE to confirm<input autoComplete="off" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} /></label>{error && <p role="alert" className="admin-error-text">{error}</p>}
        <div className="admin-actions"><button className="admin-button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className="admin-danger" disabled={busy || confirmation !== 'DELETE'} onClick={() => void deletePlayer()}>{busy ? 'Deleting…' : 'Permanently delete'}</button></div>
      </dialog>
    </>}
  </div></main>;
}
