import { useEffect, useState } from 'react';
import { fetchGiftSlides, GiftSlide, giftImageUrl } from '../utils/adminApi';

export function TopAchievement() {
  const [product, setProduct] = useState<GiftSlide | null>(null);
  useEffect(() => {
    let stopped = false;
    const refresh = async () => { try { const rows = await fetchGiftSlides('achievement'); if (!stopped) setProduct(rows[0] || null); } catch { /* Keep last successful product. */ } };
    void refresh(); const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  if (!product) return null;
  return <section className="top-achievement-wrap" aria-label="Top achievement"><div className="top-achievement-box">
    <img src={giftImageUrl(product.image_path)} alt={product.title} className="top-achievement-image" draggable={false} />
    <div className="top-achievement-copy"><span className="top-achievement-kicker">TOP ACHIEVEMENT</span>
      <strong className="top-achievement-title">{product.title}</strong><span className="top-achievement-subtitle">Complete 15 Waves to Win</span>
    </div></div></section>;
}
