import { useEffect, useRef, useState } from 'react';
import { composeFrame } from '../lib/images';
import type { FrameOptions, Layout, Photo } from '../lib/layouts';
import { Dialog } from './Dialog';

export function FramePreview({ layout, photos, options, disabled }: { layout: Layout; photos: (Photo | null)[]; options: FrameOptions; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [large, setLarge] = useState('');
  const [preview, setPreview] = useState('');
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let disposed = false;
    setWorking(true);
    const timer = setTimeout(() => composeFrame(layout, photos, options, 900).then(canvas => {
      if (!disposed && ref.current) { canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Bản xem trước khung ảnh đã chọn'); ref.current.replaceChildren(canvas); setPreview(canvas.toDataURL('image/png')); setError(''); setWorking(false); }
    }).catch(() => { if (!disposed) { setError('Chưa tải được bản xem trước. Hãy thử đổi khung.'); setWorking(false); } }), 80);
    return () => { disposed = true; clearTimeout(timer); };
  }, [layout, photos, options]);
  return <><button className={`frame-preview-trigger ${working ? 'is-developing' : ''}`} disabled={disabled || !preview} onClick={() => setLarge(preview)} aria-label="Phóng lớn chiếc khung của bạn"><div className="frame-preview" ref={ref} /><span>{working ? 'Đang lên màu…' : 'Nhấn để xem lớn ↗'}</span></button>{error && <p role="alert" className="small">{error}</p>}{large && <Dialog title="Chiếc khung của bạn" onClose={() => setLarge('')} className="frame-large"><img src={large} alt="Xem lớn bố cục hiện tại" /></Dialog>}</>;
}
