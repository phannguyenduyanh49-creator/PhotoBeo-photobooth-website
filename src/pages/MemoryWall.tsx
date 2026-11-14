import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowDownToLine, Camera, Heart, LoaderCircle, Plus, Redo2, Save, ShieldCheck, StickyNote, Undo2 } from 'lucide-react';
import { deletePhoto, deleteSession, getPhotos, getWall, saveWall } from '../lib/api';
import { emptyWall, stickers, type PhotoRecord, type WallDocument, type WallItem } from '../lib/wall';
import { pngBlob } from '../lib/images';
import { useWallHistory } from '../hooks/useWallHistory';
import { PhotoLibrary } from '../components/wall/PhotoLibrary';
import { WallCanvas, renderWall } from '../components/wall/WallCanvas';
import { WallInspector } from '../components/wall/WallInspector';

export function MemoryWall({ onBooth, initialPhotoId }: { onBooth: () => void; initialPhotoId?: string }) {
  const history = useWallHistory();
  const [photos, setPhotos] = useState<PhotoRecord[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [connected, setConnected] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [selected, setSelected] = useState<string | null>(null), [zoom, setZoom] = useState(100);
  const [revision, setRevision] = useState(0), [saved, setSaved] = useState(JSON.stringify(emptyWall));
  const loadedInitial = useRef(false), lock = useRef(false), alive = useRef(true), loadGeneration = useRef(0);
  const dirty = JSON.stringify(history.present) !== saved;
  const chosen = history.present.items.find(item => item.id === selected);
  function report(err: unknown) { setError(err instanceof Error ? err.message : 'Không kết nối được Góc kỷ niệm.'); }
  async function load() {
    const generation = ++loadGeneration.current;
    setLoading(true); setError('');
    try {
      const [library, wall] = await Promise.all([getPhotos(), getWall()]);
      if (!alive.current || generation !== loadGeneration.current) return;
      setConnected(true);
      setPhotos(library.photos); const doc = { items: wall.items, background: wall.background };
      history.reset(doc); setSaved(JSON.stringify(doc)); setRevision(wall.revision); setSelected(null);
      setMessage(wall.updatedAt ? `Đã tải bảng lưu lúc ${new Date(wall.updatedAt).toLocaleString('vi-VN')}.` : 'Trang giấy đang chờ những kỷ niệm của bạn.');
      if (!loadedInitial.current && initialPhotoId) {
        loadedInitial.current = true; const record = library.photos.find(p => p.photoId === initialPhotoId);
        if (record && !doc.items.some(i => i.photoId === record.photoId)) {
          const item = photoItem(record, doc.items.length); history.change({ ...doc, items: [...doc.items, item] }); setSelected(item.id);
        }
      }
    } catch (err) { if (alive.current && generation === loadGeneration.current) { setConnected(false); report(err); } }
    finally { if (alive.current && generation === loadGeneration.current) setLoading(false); }
  }
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; loadGeneration.current++; }; }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (busy || loading || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? history.redo() : history.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); history.redo(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [history, busy, loading]);
  function photoItem(photo: PhotoRecord, index: number): WallItem {
    const ratio = photo.width / photo.height, height = 360, width = height * ratio;
    return { id: crypto.randomUUID(), type: 'photo', photoId: photo.photoId, x: 90 + index % 4 * 110, y: 90 + index % 3 * 70, width, height, rotation: index % 2 ? 5 : -5 };
  }
  function add(item: WallItem) {
    if (history.present.items.length >= 60) { setError('Mỗi bảng tối đa 60 đối tượng. Hãy gỡ bớt trước khi thêm.'); return; }
    history.change({ ...history.present, items: [...history.present.items, item] }); setSelected(item.id); setError('');
  }
  function addDecoration(type: 'note' | 'tape' | 'sticker', stickerId?: string) {
    add({ id: crypto.randomUUID(), type, x: 380, y: 160, width: type === 'note' ? 240 : type === 'tape' ? 170 : 90, height: type === 'note' ? 180 : type === 'tape' ? 42 : 90, rotation: -6,
      ...(type === 'note' ? { text: 'Một ngày thật xinh, cùng những người mình thương ♡', color: '#fff1bf' } : type === 'tape' ? { color: '#e9c9d7' } : { stickerId }) });
  }
  function update(item: WallItem) { history.change({ ...history.present, items: history.present.items.map(i => i.id === item.id ? item : i) }); }
  function layer(direction: number) {
    const items = [...history.present.items], index = items.findIndex(i => i.id === selected), next = Math.max(0, Math.min(items.length - 1, index + direction));
    if (index < 0 || next === index) return;
    [items[index], items[next]] = [items[next], items[index]]; history.change({ ...history.present, items });
  }
  async function persist(exporting = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const doc = history.present; const response = await saveWall(doc, revision);
      setRevision(response.revision); setSaved(JSON.stringify(doc));
      if (exporting) {
        const canvas = await renderWall(doc, photos, 8 / 3); const blob = await pngBlob(canvas);
        const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `PhotoBeo-Goc-ky-niem-${new Date().toISOString().slice(0, 10)}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500); setMessage('Đã lưu bố cục và xuất PNG 3200 × 2400 px.');
      } else setMessage('Đã lưu bố cục riêng tư trên máy chủ.');
    } catch (err) { report(err); }
    finally { lock.current = false; setBusy(false); }
  }
  async function removePhoto(photo: PhotoRecord) {
    if (!window.confirm('Xóa vĩnh viễn ảnh này khỏi thư viện riêng tư? Hãy tải bản sao nếu bạn muốn giữ lại.')) return;
    setBusy(true); setError('');
    try { await deletePhoto(photo.photoId); setPhotos(current => current.filter(p => p.photoId !== photo.photoId)); setMessage('Đã xóa ảnh khỏi thư viện.'); } catch (err) { report(err); } finally { setBusy(false); }
  }
  async function erase() {
    if (!window.confirm('Xóa toàn bộ ảnh, bố cục và phiên riêng tư này trên máy chủ? Thao tác không thể hoàn tác.')) return;
    setBusy(true); setError('');
    try { await deleteSession(); history.reset(emptyWall); setSaved(JSON.stringify(emptyWall)); onBooth(); } catch (err) { report(err); } finally { setBusy(false); }
  }
  function leave() { if (busy) return; if (dirty && !window.confirm('Bố cục chưa lưu. Rời trang và bỏ các thay đổi này?')) return; onBooth(); }
  const disabled = loading || busy || !connected;
  return <div className="memory-page">
    <header className="site-header"><div className="header-inner"><button className="brand" onClick={leave}><Camera size={27} />PhotoBeo<span className="brand-spark">✧</span></button><nav><button className="nav-link" onClick={leave}>Góc chụp</button><span className="nav-link active"><Heart size={15} />Góc kỷ niệm</span></nav><span className="private-badge"><ShieldCheck size={14} />Chỉ của bạn</span></div></header>
    <main className="wall-main"><section className="wall-intro"><div><span className="eyebrow">THE LITTLE THINGS, KEPT FOREVER</span><h1>Góc kỷ niệm <em>PhotoBeo</em><span>♡</span></h1><p>Dán một bức ảnh, viết một lời thương. Giữ lại những ngày thật xinh.</p></div><button className="soft-button" onClick={leave}><ArrowLeft size={15} />Chụp thêm kỷ niệm</button></section>
      <div className="wall-toolbar"><div><button className="icon-button" disabled={disabled || !history.past.length} onClick={history.undo} aria-label="Hoàn tác"><Undo2 size={17} /></button><button className="icon-button" disabled={disabled || !history.future.length} onClick={history.redo} aria-label="Làm lại"><Redo2 size={17} /></button><span className="toolbar-divider" /><button className="soft-button" disabled={disabled} onClick={() => addDecoration('note')}><StickyNote size={15} />Ghi chú</button><button className="soft-button" disabled={disabled} onClick={() => addDecoration('tape')}><Plus size={15} />Băng dính</button></div><div><span className={`save-state ${dirty ? 'unsaved' : ''}`}>{dirty ? 'Chưa lưu' : 'Đã đồng bộ'}</span><button className="soft-button" disabled={disabled} onClick={() => void persist()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}Lưu bảng</button><button className="primary" disabled={disabled} onClick={() => void persist(true)}><ArrowDownToLine size={15} />Xuất PNG</button></div></div>
      {error && <div className="message error-message" role="alert"><span>{error}</span><button className="text-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Tải bản đã lưu sẽ bỏ các thay đổi chưa lưu. Tiếp tục?')) void load(); }}>Tải lại bảng</button></div>}
      {message && <p className="wall-status" role="status">{message}</p>}
      <div className="wall-workspace"><PhotoLibrary photos={photos} disabled={disabled} onAdd={p => add(photoItem(p, history.present.items.length))} onDelete={p => void removePhoto(p)} onBooth={leave} />
        <section className="wall-board-section" aria-label="Bảng kỷ niệm"><div className="board-label"><span>TRANG GIẤY CỦA BẠN</span><span>1200 × 900 · Xuất HD</span></div><WallCanvas doc={history.present} records={photos} selected={selected} disabled={disabled} zoom={zoom} onSelect={setSelected} onChange={history.change} onBegin={history.begin} onPreview={history.preview} onCommit={history.commit} onCancel={history.cancel} onError={setError} /><div className="board-bottom"><span>Kéo ảnh để sắp xếp · Không nhận tệp kéo từ máy</span><label>Zoom <input type="range" min="75" max="180" value={zoom} onChange={e => setZoom(+e.target.value)} />{zoom}%</label></div>{loading && <p className="message"><LoaderCircle className="spin" size={17} />Đang kết nối thư viện riêng tư…</p>}</section>
        <div className="wall-right"><section className="sticker-palette panel"><h3>Một chút đáng yêu</h3><p>Những điểm nhấn nho nhỏ.</p><div>{stickers.map(s => <button key={s.id} disabled={disabled} title={s.label} aria-label={`Thêm sticker ${s.label}`} style={{ color: s.color }} onClick={() => addDecoration('sticker', s.id)}>{s.glyph}</button>)}</div><label>Màu trang giấy<input aria-label="Màu trang giấy" type="color" disabled={disabled} value={history.present.background} onChange={e => history.change({ ...history.present, background: e.target.value })} /></label></section><WallInspector item={chosen} disabled={disabled} onChange={update} onLayer={layer} onDelete={() => { history.change({ ...history.present, items: history.present.items.filter(i => i.id !== selected) }); setSelected(null); }} /></div>
      </div><div className="wall-footer"><p><ShieldCheck size={14} />Ảnh và bảng riêng tư gắn với cookie trình duyệt trong 30 ngày. Hãy xuất PNG để giữ lâu dài.</p><button disabled={disabled} className="text-button danger" onClick={() => void erase()}>Xóa dữ liệu riêng tư của tôi</button></div>
    </main>
  </div>;
}
