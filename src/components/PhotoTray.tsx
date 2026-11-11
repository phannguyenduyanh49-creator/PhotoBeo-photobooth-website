import { ArrowUpRight, ImagePlus, RotateCcw, Upload } from 'lucide-react';
import type { FrameOptions, Layout, Photo } from '../lib/layouts';
import { FramePreview } from './FramePreview';

type Props = { layout: Layout; photos: (Photo | null)[]; options: FrameOptions; selected: number | null; disabled: boolean; cameraReady: boolean; onSelect: (i: number) => void; onUpload: (i: number) => void; onRetake: (i: number) => void; onResult: () => void; exporting: boolean };
export function PhotoTray({ layout, photos, options, selected, disabled, cameraReady, onSelect, onUpload, onRetake, onResult, exporting }: Props) {
  const count = photos.slice(0, layout.count).filter(Boolean).length;
  return <aside className="photo-tray panel">
    <div className="panel-heading"><h2>Những khoảnh khắc</h2><span className="count-pill">{count}/{layout.count}</span></div>
    <p className="panel-description">Từng chút xinh, ghép thành kỷ niệm.</p>
    <div className={`photo-slots ${layout.count > 4 ? 'many-slots' : ''}`}>{Array.from({ length: layout.count }, (_, i) => <div className={`photo-slot ${selected === i ? 'selected' : ''} ${photos[i] ? 'filled' : ''}`} key={i}>
      <button className="slot-select" disabled={disabled} aria-label={`Chọn ảnh ${i + 1}${photos[i] ? ' để thay thế' : ''}`} aria-pressed={selected === i} onClick={() => onSelect(i)}>
        {photos[i] ? <img src={photos[i]!.src} alt={`Ảnh ${i + 1}, ${photos[i]!.filterName}`} /> : <><ImagePlus size={25} strokeWidth={1.3} /><span>Khoảnh khắc {String(i + 1).padStart(2, '0')}</span></>}
        <span className="slot-number">{String(i + 1).padStart(2, '0')}</span>
      </button>
      <div className="slot-actions"><button disabled={disabled} onClick={() => onUpload(i)} aria-label={`Tải ảnh lên ô ${i + 1}`}><Upload size={12} /><span>{photos[i] ? 'Thay ảnh' : 'Tải ảnh'}</span></button>{photos[i] && <button disabled={disabled || !cameraReady} onClick={() => onRetake(i)} aria-label={`Chụp lại ảnh ${i + 1}`} title="Chụp lại ảnh này"><RotateCcw size={13} /></button>}</div>
    </div>)}</div>
    <div className="preview-heading"><span>Chiếc khung của bạn</span><span>♡</span></div>
    <FramePreview layout={layout} photos={photos} options={options} />
    <button className="primary result-button" disabled={disabled || count !== layout.count} onClick={onResult}>{exporting ? 'Đang ghép ảnh…' : 'Xem thành phẩm'}<ArrowUpRight size={17} /></button>
    <p className="tray-footnote">{count === layout.count ? 'Bộ ảnh xinh đã sẵn sàng!' : `Thêm ${layout.count - count} ảnh nữa là đủ bộ nhé`}</p>
  </aside>;
}
