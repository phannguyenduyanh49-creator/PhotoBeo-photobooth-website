import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { boundedItem, type WallItem } from '../../lib/wall';

export function WallInspector({ item, disabled, onChange, onLayer, onDelete }: { item?: WallItem; disabled: boolean; onChange: (item: WallItem) => void; onLayer: (direction: number) => void; onDelete: () => void }) {
  if (!item) return <aside className="wall-inspector panel"><h3>Một chút chỉn chu</h3><p>Chọn một ảnh, sticker hoặc lời nhắn để chỉnh kích thước, góc xoay và lớp hiển thị.</p><div className="wall-tips">Kéo để di chuyển<br />Chấm góc để thu/phóng<br />Nút tròn để xoay<br />Phím mũi tên để căn chỉnh</div></aside>;
  const ratio = item.width / item.height;
  return <aside className="wall-inspector panel"><h3>Chỉnh chút xinh</h3><fieldset disabled={disabled}>
    <label>Kích thước <output>{Math.round(item.width)} px</output><input aria-label="Kích thước đối tượng" type="range" min={Math.ceil(Math.max(40, 30 * ratio))} max={Math.floor(Math.min(1100, 820 * ratio))} value={item.width} onChange={e => onChange(boundedItem({ ...item, width: +e.target.value, height: +e.target.value / ratio }))} /></label>
    <label>Góc xoay <output>{Math.round(item.rotation)}°</output><input aria-label="Góc xoay đối tượng" type="range" min="-180" max="180" value={item.rotation} onChange={e => onChange({ ...item, rotation: +e.target.value })} /></label>
    {item.type === 'note' && <label>Lời nhắn<textarea aria-label="Nội dung ghi chú" maxLength={200} value={item.text || ''} onChange={e => onChange({ ...item, text: e.target.value })} /><small>{item.text?.length || 0}/200</small></label>}
    {['note', 'tape'].includes(item.type) && <label>Màu giấy<input type="color" aria-label="Màu đối tượng" value={item.color || '#fff1bf'} onChange={e => onChange({ ...item, color: e.target.value })} /></label>}
    <div className="layer-buttons"><button className="soft-button" onClick={() => onLayer(1)}><ArrowUp size={15} />Lên trước</button><button className="soft-button" onClick={() => onLayer(-1)}><ArrowDown size={15} />Ra sau</button></div>
    <button className="text-button danger" onClick={onDelete}><Trash2 size={15} />Gỡ khỏi trang giấy</button>
  </fieldset></aside>;
}
