import { Check, ChevronDown, Heart, LayoutGrid, Palette, Timer } from 'lucide-react';
import { frames, layouts, type FrameId, type FrameOptions, type Layout, type LayoutId } from '../lib/layouts';
import { LayoutThumbnail } from './LayoutThumbnail';

type Props = {
  disabled: boolean; layout: Layout; onLayout: (id: LayoutId) => void;
  options: FrameOptions; onOptions: (value: Partial<FrameOptions>) => void;
  timer: string; onTimer: (timer: string) => void; customTimer: number; onCustomTimer: (n: number) => void;
};
export function Settings({ disabled, layout, onLayout, options, onOptions, timer, onTimer, customTimer, onCustomTimer }: Props) {
  function selectFrame(id: FrameId) { const frame = frames.find(f => f.id === id)!; onOptions({ frame: id, color: frame.color }); }
  return <aside className="settings panel">
    <div className="panel-heading"><span className="section-icon"><Palette size={17} /></span><h2>Một chút của bạn</h2></div>
    <fieldset disabled={disabled}>
      <div className="setting-section">
        <h3><LayoutGrid size={15} /> Bố cục ảnh <span className="tiny-label">{layout.count} ảnh</span></h3>
        <div className="layout-choices">{layouts.map(item => <button key={item.id} className={`layout-choice ${layout.id === item.id ? 'selected' : ''}`} onClick={() => onLayout(item.id)} aria-pressed={layout.id === item.id}>
          <LayoutThumbnail layout={item} /><span>{item.name}</span>{layout.id === item.id && <Check className="choice-check" size={13} />}
        </button>)}</div>
      </div>
      <div className="setting-section">
        <h3><Heart size={15} /> Chọn chiếc khung</h3>
        <div className="frame-choices">{frames.map(frame => <button key={frame.id} className={`frame-choice ${options.frame === frame.id ? 'selected' : ''}`} aria-label={frame.name} aria-pressed={options.frame === frame.id} onClick={() => selectFrame(frame.id)}>
          <span aria-hidden="true" className={`frame-swatch frame-${frame.id}`} style={{ backgroundColor: frame.color }}>{frame.id === 'bows' ? <svg width="29" height="26" viewBox="0 0 40 32" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 13C-3-10-3 29 20 13C43-10 43 29 20 13M20 13L12 30M20 13L28 30" /></svg> : frame.symbol}</span><span>{frame.name}</span>
        </button>)}</div>
        <div className="color-row"><span>Màu khung</span><div className="color-swatches">{['#ffe4ee', '#ffffff', '#f0e5fb', '#e0ebe4', '#f1e2c9'].map(color => <button key={color} style={{ backgroundColor: color }} className={`color-dot ${options.color === color ? 'active' : ''}`} onClick={() => onOptions({ color })} aria-label={`Màu khung ${color}`} aria-pressed={options.color === color} />)}<label className="custom-color" title="Màu tùy chọn"><input type="color" value={options.color} onChange={e => onOptions({ color: e.target.value })} aria-label="Màu khung tùy chọn" /><Palette size={13} /></label></div></div>
        <label className="field-label" htmlFor="caption">Lời nhắn nhỏ <span>{options.caption.length}/50</span></label>
        <input id="caption" maxLength={50} value={options.caption} onChange={e => onOptions({ caption: e.target.value })} placeholder="Một ngày thật xinh ♡" />
        <label className="switch-row"><span>In ngày chụp</span><input className="switch" type="checkbox" checked={options.showDate} onChange={e => onOptions({ showDate: e.target.checked })} /></label>
      </div>
      <div className="setting-section timer-section">
        <h3><Timer size={15} /> Đếm ngược</h3>
        <div className="select-wrap"><select aria-label="Thời gian đếm ngược" value={timer} onChange={e => onTimer(e.target.value)}><option value="0">Không đếm ngược</option><option value="3">3 giây · Vừa đủ tạo dáng</option><option value="5">5 giây</option><option value="10">10 giây</option><option value="custom">Tùy chỉnh (1–15 giây)</option></select><ChevronDown size={15} /></div>
        {timer === 'custom' && <label className="custom-timer">Số giây <input type="number" min="1" max="15" value={customTimer} onChange={e => onCustomTimer(Math.max(1, Math.min(15, Number(e.target.value) || 1)))} /></label>}
      </div>
    </fieldset>
    <div className="settings-note"><Heart size={14} /><p>Không cần hoàn hảo.<br />Chỉ cần là bạn.</p></div>
  </aside>;
}
