import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Gift, Pause, Play } from 'lucide-react';
import { fetchGiftSlides, GiftSlide, giftImageUrl } from '../utils/adminApi';

export function GiftSlider() {
  const [gifts, setGifts] = useState<GiftSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try { const rows = await fetchGiftSlides(); if (!stopped) setGifts(previous => {
        if (JSON.stringify(previous.map(g => g.id).sort()) === JSON.stringify(rows.map(g => g.id).sort()))
          return previous.map(g => rows.find(row => row.id === g.id)!);
        const shuffled = [...rows];
        for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
        return shuffled;
      }); }
      catch { /* Keep the last successful list during temporary network errors. */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    if (paused || hovered || gifts.length < 2) return;
    const timer = window.setInterval(() => { if (!document.hidden) setIndex(i => (i + 1) % gifts.length); }, 5000);
    return () => clearInterval(timer);
  }, [paused, hovered, gifts.length]);
  if (!gifts.length) return null;
  const selected = index % gifts.length;
  const gift = gifts[selected];
  return <section className="gift-showcase" aria-label="Gift showcase" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setHovered(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false); }}>
    <div className="gift-showcase-heading"><h3><Gift size={18} /> GIFT SHOWCASE</h3>
      {gifts.length > 1 && <button type="button" className="gift-arrow" aria-label={paused ? 'Play gift slideshow' : 'Pause gift slideshow'} onClick={() => setPaused(p => !p)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
    </div>
    <div className="gift-image-stage">
      {gifts.length > 1 && <button type="button" className="gift-arrow" aria-label="Previous gift" onClick={() => setIndex((selected + gifts.length - 1) % gifts.length)}><ChevronLeft size={18} /></button>}
      <img src={giftImageUrl(gift.image_path)} alt={gift.title} loading="lazy" />
      {gifts.length > 1 && <button type="button" className="gift-arrow" aria-label="Next gift" onClick={() => setIndex((selected + 1) % gifts.length)}><ChevronRight size={18} /></button>}
    </div>
    <strong className="gift-caption">{gift.title}</strong>
    {gifts.length > 1 && <div className="gift-pagination">{gifts.map((g, i) => <button key={g.id} type="button" aria-label={`Show gift ${i + 1}: ${g.title}`} aria-current={i === selected ? 'true' : undefined} className={i === selected ? 'active' : ''} onClick={() => setIndex(i)} />)}</div>}
  </section>;
}
