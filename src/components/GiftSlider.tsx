import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { fetchGiftSlides, GiftSlide, giftImageUrl } from '../utils/adminApi';

export function GiftSlider() {
  const [gifts, setGifts] = useState<GiftSlide[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try {
        const rows = await fetchGiftSlides();
        if (stopped) return;
        setGifts(previous => {
          if (JSON.stringify(previous.map(g => g.id).sort()) === JSON.stringify(rows.map(g => g.id).sort())) {
            return previous.map(g => rows.find(row => row.id === g.id)!);
          }
          const shuffled = [...rows];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        });
      } catch { /* Preserve the last successful slides on temporary errors. */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  useEffect(() => {
    if (gifts.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(i => (i + 1) % gifts.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [gifts.length]);

  const gift = gifts.length ? gifts[index % gifts.length] : undefined;
  return (
    <section className="gift-showcase" aria-label="Gift showcase" aria-roledescription="carousel">
      <div className="gift-showcase-heading"><h3><Gift size={18} /> GIFT SHOWCASE</h3></div>
      {gift ? <>
        <div className="gift-image-stage">
          <img src={giftImageUrl(gift.image_path)} alt={gift.title} loading="lazy" draggable={false} onContextMenu={(event) => event.preventDefault()} />
        </div>
        <strong className="gift-caption">{gift.title}</strong>
      </> : <div className="gift-empty"><Gift size={36} aria-hidden="true" /><strong>COMING SOON</strong></div>}
    </section>
  );
}
