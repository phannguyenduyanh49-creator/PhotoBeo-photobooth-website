import { useEffect, useRef, useState } from 'react';
import { composeFrame } from '../lib/images';
import type { FrameOptions, Layout, Photo } from '../lib/layouts';

export function FramePreview({ layout, photos, options }: { layout: Layout; photos: (Photo | null)[]; options: FrameOptions }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    composeFrame(layout, photos, options, 600).then(canvas => {
      if (!disposed && ref.current) { canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Bản xem trước khung ảnh đã chọn'); ref.current.replaceChildren(canvas); setError(''); }
    }).catch(() => { if (!disposed) setError('Chưa tải được bản xem trước. Hãy thử đổi khung.'); });
    return () => { disposed = true; };
  }, [layout, photos, options]);
  return <><div className="frame-preview" ref={ref} />{error && <p role="alert" className="small">{error}</p>}</>;
}
