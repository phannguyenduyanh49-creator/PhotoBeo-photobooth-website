import { useEffect, useState } from 'react';
import { Camera, Heart, Download, Trash2, ShieldCheck, KeyRound, RefreshCw } from 'lucide-react';
import { createRecoveryKey, deletePhoto, getPhotos, restoreAccount } from '../lib/api';
import type { PhotoRecord } from '../lib/wall';

export function PhotoHistory({ onBooth, onWall }: { onBooth: () => void; onWall: (id?: string) => void }) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [key, setKey] = useState(''), [restore, setRestore] = useState(''), [message, setMessage] = useState('');
  async function load() { setError(''); try { setPhotos((await getPhotos()).photos); } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được lịch sử.'); } finally { setLoading(false); } }
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 4 * 60_000); return () => clearInterval(timer); }, []);
  async function remove(p: PhotoRecord) {
    if (!window.confirm('Xóa ảnh khỏi lịch sử? Bản sao đã lưu trên Memory Wall vẫn được giữ.')) return;
    setBusy(true); try { await deletePhoto(p.photoId); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function recovery() {
    if (!window.confirm('Tạo mã khôi phục mới? Mã cũ sẽ mất hiệu lực. Hãy lưu mã ở nơi riêng tư.')) return;
    setBusy(true); try { setKey((await createRecoveryKey()).recoveryKey); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function restoreLibrary() {
    setBusy(true); setError('');
    try { await restoreAccount(restore.trim()); setRestore(''); setKey(''); setMessage('Đã khôi phục thư viện riêng tư.'); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function downloadKey() {
    const url = URL.createObjectURL(new Blob([`PhotoBeo — mã khôi phục riêng tư\n${key}\nGiữ bí mật: người có mã này có thể truy cập và xóa thư viện của bạn.`], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'PhotoBeo-ma-khoi-phuc.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return <div className="history-page"><header className="site-header"><div className="header-inner"><button className="brand" onClick={onBooth}><Camera />PhotoBeo</button><nav><button className="nav-link" onClick={onBooth}>Góc chụp</button><span className="nav-link active">Lịch sử ảnh</span><button className="nav-link" onClick={() => onWall()}>Góc kỷ niệm</button></nav></div></header>
    <main className="history-main"><section className="history-intro"><span className="eyebrow">NHỮNG NGÀY THẬT XINH</span><h1>Ngăn ảnh <em>của bạn.</em></h1><p>30 ngày để xem lại, tải về và chọn những khoảnh khắc muốn giữ lâu hơn.</p><button className="soft-button" disabled={busy} onClick={() => void load()}><RefreshCw size={15} />Tải lại lịch sử</button></section>
      {error && <p role="alert" className="message error-message">{error}</p>}{message && <p role="status" className="message">{message}</p>}
      {loading ? <p role="status">Đang mở ngăn ảnh…</p> : !photos.length ? <div className="history-empty panel"><Camera size={42} /><h2>Chưa có ảnh trong lịch sử</h2><p>Hoàn thành một bộ ảnh và chọn “Lưu vào lịch sử”.</p><button className="primary" onClick={onBooth}>Tạo bộ ảnh đầu tiên</button></div> : <div className="history-grid">{photos.map(p => <article className="history-card panel" key={p.photoId}><a href={p.url} download={`PhotoBeo-${p.photoId}.png`} aria-label="Tải ảnh lịch sử"><img src={p.url} alt={`Bộ ảnh ngày ${new Date(p.createdAt).toLocaleDateString('vi-VN')}`} /></a><h2>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</h2><p>Lưu lúc {new Date(p.createdAt).toLocaleTimeString('vi-VN')}</p><p className="expiry">Hết hạn: <time dateTime={p.expiresAt!}>{new Date(p.expiresAt!).toLocaleString('vi-VN')}</time></p><div className="history-actions"><a className="soft-button" href={p.url} download={`PhotoBeo-${p.photoId}.png`}><Download size={15} />Tải HD</a><button className="soft-button" disabled={busy} onClick={() => onWall(p.photoId)}><Heart size={15} />Giữ trên Wall</button><button className="icon-button" disabled={busy} aria-label={`Xóa ảnh lịch sử ${p.photoId}`} onClick={() => void remove(p)}><Trash2 size={16} /></button></div></article>)}</div>}
      <section className="recovery-panel panel"><div><KeyRound size={24} /><h2>Giữ lối về ngăn ảnh</h2><p>Cookie đăng nhập có thời hạn 30 ngày. Mã khôi phục mở lại cùng thư viện trên thiết bị khác hoặc khi cookie hết hạn. Mã này cho toàn quyền truy cập; hãy giữ bí mật.</p><button className="soft-button" disabled={busy} onClick={() => void recovery()}>Tạo mã khôi phục</button>{key && <div className="recovery-key"><label>Mã mới (chỉ hiện lần này)<input aria-label="Mã khôi phục mới" readOnly value={key} /></label><button className="primary" onClick={downloadKey}>Tải mã khôi phục</button><button className="text-button" onClick={() => setKey('')}>Ẩn mã</button></div>}</div><form onSubmit={e => { e.preventDefault(); void restoreLibrary(); }}><h3>Mở lại thư viện đã có</h3><label htmlFor="restore-key">Mã khôi phục</label><input id="restore-key" type="password" autoComplete="off" spellCheck={false} value={restore} onChange={e => setRestore(e.target.value)} /><button className="primary" disabled={busy || restore.trim().length !== 64}>Khôi phục thư viện</button></form></section>
      <p className="privacy-note"><ShieldCheck size={16} />Lịch sử hết hạn sau 30 ngày. Bản sao Memory Wall lưu riêng, không có ngày hết hạn và không tự công khai.</p>
    </main></div>;
}
