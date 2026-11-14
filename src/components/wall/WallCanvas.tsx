import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Heart, RotateCw } from 'lucide-react';
import { boundedItem, paintWall, WALL_HEIGHT, WALL_WIDTH, type PhotoRecord, type WallDocument, type WallItem } from '../../lib/wall';
import { loadImage } from '../../lib/renderPhoto';

export async function renderWall(doc: WallDocument, records: PhotoRecord[], scale = 1) {
  await document.fonts.ready;
  const images = new Map<string, CanvasImageSource>();
  for (const id of new Set(doc.items.filter(i => i.type === 'photo').map(i => i.photoId!))) {
    const record = records.find(p => p.photoId === id);
    if (!record) throw new Error('Bảng có ảnh không còn trong thư viện. Hãy tải lại bảng.');
    images.set(id, await loadImage(record.url));
  }
  const canvas = document.createElement('canvas'); canvas.width = WALL_WIDTH * scale; canvas.height = WALL_HEIGHT * scale;
  paintWall(canvas.getContext('2d')!, doc, images, scale); return canvas;
}
type Props = {
  doc: WallDocument; records: PhotoRecord[]; selected: string | null; disabled: boolean; zoom: number;
  onSelect: (id: string | null) => void; onChange: (doc: WallDocument) => void; onBegin: () => void;
  onPreview: (doc: WallDocument) => void; onCommit: () => void; onCancel: () => void; onError: (message: string) => void;
};
export function WallCanvas({ doc, records, selected, disabled, zoom, onSelect, onChange, onBegin, onPreview, onCommit, onCancel, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null), canvasHost = useRef<HTMLDivElement>(null);
  const docRef = useRef(doc); docRef.current = doc;
  const [drawing, setDrawing] = useState(true);
  const gesture = useRef<{ mode: 'move' | 'resize' | 'rotate'; item: WallItem; startX: number; startY: number; scale: number; angle: number; rect: DOMRect } | null>(null);
  useEffect(() => {
    let alive = true;
    renderWall(doc, records).then(canvas => {
      if (alive && canvasHost.current) { canvas.setAttribute('aria-label', 'Trang giấy kỷ niệm'); canvasHost.current.replaceChildren(canvas); setDrawing(false); }
    }).catch(err => { if (alive) { setDrawing(false); onError(err.message); } });
    return () => { alive = false; };
  }, [doc, records]);
  function start(e: ReactPointerEvent<HTMLElement>, item: WallItem, mode: 'move' | 'resize' | 'rotate') {
    if (disabled || e.button !== 0) return;
    e.stopPropagation(); e.preventDefault(); onSelect(item.id); onBegin();
    const rect = hostRef.current!.getBoundingClientRect(), scale = rect.width / WALL_WIDTH;
    gesture.current = { mode, item: { ...item }, startX: e.clientX, startY: e.clientY, scale, rect,
      angle: Math.atan2((e.clientY - rect.top) / scale - item.y - item.height / 2, (e.clientX - rect.left) / scale - item.x - item.width / 2) };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current; if (!g) return;
    const dx = (e.clientX - g.startX) / g.scale, dy = (e.clientY - g.startY) / g.scale;
    let item = { ...g.item };
    if (g.mode === 'move') { item.x += dx; item.y += dy; }
    if (g.mode === 'resize') {
      const angle = item.rotation * Math.PI / 180;
      const delta = dx * Math.cos(angle) + dy * Math.sin(angle);
      const ratio = item.width / item.height;
      item.width = Math.max(Math.max(40, 30 * ratio), Math.min(1100, 820 * ratio, item.width + delta)); item.height = item.width / ratio;
    }
    if (g.mode === 'rotate') {
      const angle = Math.atan2((e.clientY - g.rect.top) / g.scale - item.y - item.height / 2, (e.clientX - g.rect.left) / g.scale - item.x - item.width / 2);
      item.rotation = ((item.rotation + (angle - g.angle) * 180 / Math.PI + 540) % 360) - 180;
    }
    item = boundedItem(item);
    onPreview({ ...docRef.current, items: docRef.current.items.map(i => i.id === item.id ? item : i) });
  }
  function finish() { if (gesture.current) { gesture.current = null; onCommit(); } }
  function cancel() { if (gesture.current) { gesture.current = null; onCancel(); } }
  return <div className="wall-scroll" onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); onError('Chỉ dán ảnh đã được PhotoBeo xác thực từ thư viện. Hãy đưa ảnh tải lên qua trang photobooth trước.'); }}>
    <div className="wall-paper" ref={hostRef} style={{ width: `${zoom}%`, aspectRatio: `${WALL_WIDTH}/${WALL_HEIGHT}` }} onPointerDown={e => { if (e.target === e.currentTarget) onSelect(null); }}>
      <div className="wall-canvas-image" ref={canvasHost} />
      {drawing && <div className="wall-empty"><p>Đang mở trang giấy…</p></div>}
      {!drawing && !doc.items.length && <div className="wall-empty"><Heart size={42} strokeWidth={1} /><h2>Một trang giấy, vô vàn kỷ niệm.</h2><p>Chọn ảnh từ thư viện bên trái,<br />thêm lời nhắn rồi sắp xếp theo cách của bạn.</p><span>Chỉ những bức ảnh đã hoàn thành tại PhotoBeo ♡</span></div>}
      {doc.items.map((item, index) => <div key={item.id} role="button" tabIndex={disabled ? -1 : 0} aria-label={`${item.type === 'photo' ? 'Ảnh' : item.type === 'note' ? 'Ghi chú' : item.type === 'tape' ? 'Băng dính' : 'Sticker'} trên bảng ${index + 1}`} aria-pressed={selected === item.id}
        className={`wall-hit ${selected === item.id ? 'selected' : ''}`} style={{ left: `${item.x / 12}%`, top: `${item.y / 9}%`, width: `${item.width / 12}%`, height: `${item.height / 9}%`, transform: `rotate(${item.rotation}deg)` }}
        onFocus={() => onSelect(item.id)} onPointerDown={e => start(e, item, 'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={finish}
        onKeyDown={e => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item.id); }
          const delta = e.shiftKey ? 10 : 2;
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault(); const next = boundedItem({ ...item, x: item.x + (e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0), y: item.y + (e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0) });
            onChange({ ...doc, items: doc.items.map(i => i.id === item.id ? next : i) });
          }
        }}>
        {selected === item.id && !disabled && <><span className="wall-selection-label">{Math.round(item.rotation)}°</span><button className="wall-rotate" aria-label="Kéo để xoay" onPointerDown={e => start(e, item, 'rotate')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel}><RotateCw size={15} /></button><button className="wall-resize" aria-label="Kéo để đổi kích thước" onPointerDown={e => start(e, item, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} /></>}
      </div>)}
    </div>
  </div>;
}
