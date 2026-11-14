import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Check, Heart, ImagePlus, LoaderCircle, Maximize, Share2, ShieldCheck, Sparkles, ZoomIn } from 'lucide-react';
import { Dialog } from './Dialog';
import { registerPhoto } from '../lib/api';
import type { FrameOptions, LayoutId, Photo } from '../lib/layouts';
import type { PhotoRecord } from '../lib/wall';

export type ResultData = { url: string; blob: Blob; name: string; width: number; height: number };
type Props = { result: ResultData; photos: Photo[]; layoutId: LayoutId; options: FrameOptions; effects: boolean; onClose: () => void; onReset: () => void; onWall: (photoId?: string) => void };
export function ResultViewer({ result, photos, layoutId, options, effects, onClose, onReset, onWall }: Props) {
  const [zoom, setZoom] = useState(100), [consent, setConsent] = useState(false), [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false), [record, setRecord] = useState<PhotoRecord | null>(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const requestId = useRef(crypto.randomUUID()), stageRef = useRef<HTMLDivElement>(null), alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const displayUrl = record?.url || result.url;
  async function save() {
    if (!agree || lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try { const response = await registerPhoto(photos, layoutId, options, requestId.current); if (alive.current) { setRecord(response.photo); setConsent(false); setMessage('Đã xác thực và lưu riêng tư. Thành phẩm trên máy chủ đang được hiển thị.'); } }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Không thể lưu ảnh.'); }
    finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  async function share() {
    setError('');
    try {
      const blob = record ? await fetch(record.url, { credentials: 'same-origin' }).then(res => { if (!res.ok) throw new Error('Không đọc được ảnh đã lưu.'); return res.blob(); }) : result.blob;
      const file = new File([blob], result.name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Một chút kỷ niệm cùng PhotoBeo' });
      else setMessage('Trình duyệt chưa hỗ trợ chia sẻ tệp. Hãy chọn “Tải ảnh HD”, rồi gửi ảnh bằng ứng dụng bạn thích.');
    } catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) setError('Chưa chia sẻ được ảnh. Bạn vẫn có thể tải ảnh HD.'); }
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (stageRef.current?.requestFullscreen) await stageRef.current.requestFullscreen(); else setMessage('Trình duyệt này chưa hỗ trợ toàn màn hình; bạn có thể dùng thanh phóng to.'); }
    catch { setMessage('Không mở được toàn màn hình. Bạn vẫn có thể phóng to ảnh bằng thanh zoom.'); }
  }
  return <Dialog title="Một chút kỷ niệm, dành cho bạn" className={`result-dialog result-v2 ${effects ? 'with-effects' : ''}`} onClose={() => { if (!saving) onClose(); }}>
    <div className="result-layout">
      <div className="result-stage" ref={stageRef}>
        <div className="result-stage-tools"><span><Sparkles size={14} /> {record ? 'Đã lưu riêng tư' : 'Bộ ảnh của bạn'}</span><button onClick={() => void fullscreen()} aria-label="Xem toàn màn hình"><Maximize size={16} /></button></div>
        <div className="zoom-viewport"><div className="zoom-content"><img src={displayUrl} alt="Thành phẩm PhotoBeo — giống hệt ảnh PNG tải về" style={{ height: `${Math.min(window.innerHeight * .56, 620) * zoom / 100}px`, maxWidth: 'none' }} /></div></div>
        <label className="zoom-control"><ZoomIn size={15} /><span>Phóng to</span><input aria-label="Phóng to thành phẩm" type="range" min="50" max="250" value={zoom} onChange={e => setZoom(+e.target.value)} /><output>{zoom}%</output><button onClick={() => setZoom(100)}>Vừa khung</button></label>
        {effects && <div className="celebration" aria-hidden="true">{['♡', '✦', '♡', '✧', '♥'].map((symbol, i) => <span key={i} style={{ left: `${10 + i * 19}%`, animationDelay: `${i * .16}s` }}>{symbol}</span>)}</div>}
      </div>
      <div className="result-details"><span className="eyebrow">ĐÓNG GÓI MỘT NGÀY THẬT XINH</span><h3>Giữ lại nhé,<br /><em>khoảnh khắc này.</em></h3><p>Ảnh đẹp nhất là ảnh có bạn.<br />Mang một chút kỷ niệm về thôi!</p>
        <p className="result-meta">PNG · {result.width} × {result.height} px</p>
        <a className="primary" href={displayUrl} download={result.name}><ArrowDownToLine size={18} />Tải ảnh HD</a>
        <button className="wall-save-button" disabled={saving} onClick={() => record ? onWall(record.photoId) : setConsent(true)}>{record ? <Check size={17} /> : <Heart size={17} />}{record ? 'Mở Góc kỷ niệm' : 'Thêm vào Creative Wall'}</button>
        <button className="soft-button share-button" disabled={saving} onClick={() => void share()}><Share2 size={16} />Chia sẻ ảnh</button>
        <div className="result-actions"><button className="text-button" disabled={saving} onClick={onClose}>Quay lại chỉnh sửa</button><button className="text-button" disabled={saving} onClick={onReset}><ImagePlus size={15} />Chụp bộ mới</button></div>
        <div className="private-caption"><ShieldCheck size={15} /><span>Chỉ lưu lên máy chủ khi bạn đồng ý. Góc kỷ niệm luôn riêng tư.</span></div>
        {consent && <div className="consent-card"><h4>Lưu riêng tư vào Góc kỷ niệm?</h4><p>PhotoBeo sẽ gửi các ảnh gốc và thiết lập màu/khung tới máy chủ để ghép, xác thực và lưu thành phẩm. Ảnh gốc chỉ xử lý tạm trong bộ nhớ; không được lưu lại.</p><p>Thư viện gắn với cookie của trình duyệt này trong 30 ngày. Mất cookie sẽ mất quyền truy cập. Bạn có thể xóa ảnh trong thư viện; ảnh không được công khai.</p><label><input type="checkbox" checked={agree} disabled={saving} onChange={e => setAgree(e.target.checked)} />Tôi đồng ý gửi ảnh và lưu thành phẩm riêng tư.</label><button className="primary" disabled={!agree || saving} onClick={() => void save()}>{saving ? <LoaderCircle size={16} className="spin" /> : <ShieldCheck size={16} />}{saving ? 'Đang xác thực & lưu…' : 'Đồng ý và lưu ảnh'}</button><button className="text-button" disabled={saving} onClick={() => setConsent(false)}>Để sau, giữ ảnh trên máy</button></div>}
        {error && <p className="message error-message" role="alert">{error}</p>}{message && <p className="message" role="status">{message}</p>}
      </div>
    </div>
  </Dialog>;
}
