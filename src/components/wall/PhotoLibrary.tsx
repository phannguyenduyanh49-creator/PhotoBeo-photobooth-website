import { Camera, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { PhotoRecord } from '../../lib/wall';

export function PhotoLibrary({ photos, disabled, onAdd, onDelete, onBooth }: { photos: PhotoRecord[]; disabled: boolean; onAdd: (photo: PhotoRecord) => void; onDelete: (photo: PhotoRecord) => void; onBooth: () => void }) {
  return <aside className="wall-library panel"><div className="panel-heading"><h2>Ngăn ảnh nhỏ</h2><span className="count-pill">{photos.length}</span></div><p>Những bộ ảnh đã hoàn thành và được PhotoBeo xác thực.</p>
    {!photos.length ? <div className="library-empty"><Camera size={36} strokeWidth={1.2} /><h3>Chưa có ảnh nào</h3><p>Tạo một bộ ảnh, rồi chọn “Thêm vào Creative Wall” nhé.</p><button className="primary" onClick={onBooth}>Tạo ảnh đầu tiên</button></div> : <div className="library-grid">{photos.map(photo => <div className="library-photo" key={photo.photoId}><button disabled={disabled} onClick={() => onAdd(photo)} aria-label={`Dán ảnh ${photo.photoId}`}><img src={photo.url} alt={`Bộ ảnh ngày ${new Date(photo.createdAt).toLocaleDateString('vi-VN')}`} draggable={false} /><span><Plus size={13} />Dán lên bảng</span></button><div><span><ShieldCheck size={12} />Đã xác thực</span><button aria-label={`Xóa ảnh ${photo.photoId} khỏi thư viện`} disabled={disabled} onClick={() => onDelete(photo)}><Trash2 size={13} /></button></div></div>)}</div>}
    <div className="library-privacy"><ShieldCheck size={15} /><span>Riêng tư trong trình duyệt này. Không nhận ảnh kéo thả từ máy tính.</span></div>
  </aside>;
}
