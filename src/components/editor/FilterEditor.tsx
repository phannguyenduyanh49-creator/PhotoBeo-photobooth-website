import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Check, Eye, RotateCcw, Save, SlidersHorizontal, WandSparkles, X } from 'lucide-react';
import { adjustmentLabels, defaultEdit, filterGroups, filters, type Adjustments, type EditRecipe } from '../../lib/filters';
import { coverRect } from '../../lib/layouts';
import { EditedPhoto } from './EditedPhoto';

type Preset = { name: string; edit: EditRecipe };
const PRESETS_KEY = 'photobeo.color-presets.v2';
function readPresets(): Preset[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
    return Array.isArray(data) ? data.filter(p => typeof p.name === 'string' && p.name.length <= 30 && p.edit && filters.some(f => f.id === p.edit.filterId) && Object.keys(defaultEdit).every(k => k === 'filterId' || typeof p.edit[k] === 'number' && Number.isFinite(p.edit[k]) && Math.abs(p.edit[k]) <= 100)).slice(0, 12) : [];
  } catch { return []; }
}
type Props = { edit: EditRecipe; onChange: (edit: EditRecipe) => void; disabled: boolean; originalSrc?: string; selected: number | null; before: boolean; onBefore: (value: boolean) => void; onApplyAll: () => void; hasPhotos: boolean; videoRef: RefObject<HTMLVideoElement | null>; cameraReady: boolean; mirror: boolean };
export function FilterEditor(props: Props) {
  const { edit, onChange, disabled, originalSrc, selected, before, onBefore, onApplyAll, hasPhotos, videoRef, cameraReady, mirror } = props;
  const [group, setGroup] = useState(filters.find(f => f.id === edit.filterId)?.group || 'Cơ bản');
  const [advanced, setAdvanced] = useState(false);
  const [sample, setSample] = useState('/filter-sample.jpg');
  const [presets, setPresets] = useState(readPresets);
  const [name, setName] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => {
    if (!cameraReady || originalSrc) return;
    const snapshot = () => {
      const video = videoRef.current;
      if (!video?.videoWidth || document.hidden) return;
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 180;
      const ctx = canvas.getContext('2d')!;
      const crop = coverRect(video.videoWidth, video.videoHeight, 240, 180);
      if (mirror) { ctx.translate(240, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, 240, 180);
      setSample(canvas.toDataURL('image/jpeg', .8));
    };
    snapshot(); const timer = setInterval(snapshot, 2500); return () => clearInterval(timer);
  }, [cameraReady, videoRef, originalSrc, mirror]);
  const source = originalSrc || sample;
  const previews = useMemo(() => filters.filter(f => f.group === group).map(f => ({ ...f, edit: { ...defaultEdit, filterId: f.id } })), [group]);
  function savePreset() {
    if (!name.trim()) { setMessage('Đặt tên cho công thức màu nhé.'); return; }
    const next = [...presets.filter(p => p.name !== name.trim()), { name: name.trim(), edit: { ...edit } }].slice(-12);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); setPresets(next); setName(''); setMessage('Đã lưu công thức trên trình duyệt này.'); }
    catch { setMessage('Trình duyệt không cho phép lưu công thức.'); }
  }
  function deletePreset(index: number) {
    const next = presets.filter((_, i) => i !== index);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); setPresets(next); } catch { setMessage('Không thể cập nhật công thức đã lưu.'); }
  }
  return <section className="color-editor panel" aria-label="Chỉnh màu ảnh">
    <div className="editor-heading"><div><h2><WandSparkles size={18} /> Một chút màu, thật nhiều cảm xúc</h2><p>{selected !== null && originalSrc ? `Đang chỉnh ảnh ${selected + 1} · Ảnh gốc luôn được giữ` : 'Chọn màu cho ảnh tiếp theo, hoặc chọn một ảnh đã chụp để chỉnh.'}</p></div><span className="count-pill">24 màu</span></div>
    <div className="filter-tabs" role="group" aria-label="Nhóm bộ lọc">{filterGroups.map(g => <button key={g} disabled={disabled} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}</div>
    <div className="real-filter-grid">{previews.map(f => <button className={`real-filter ${edit.filterId === f.id ? 'selected' : ''}`} key={f.id} disabled={disabled} aria-pressed={edit.filterId === f.id} aria-label={f.name} onClick={() => onChange({ ...edit, filterId: f.id })}>
      <div><EditedPhoto src={source} edit={f.edit} width={160} alt={`Xem màu ${f.name}`} />{edit.filterId === f.id && <span className="filter-check"><Check size={13} /></span>}</div><strong>{f.name}</strong><span>{f.description}</span>
    </button>)}</div>
    {group === 'Film' && <p className="editor-disclaimer">Tên màu gợi cảm hứng phim ảnh, không mô phỏng chính xác màu của hãng.</p>}
    <fieldset disabled={disabled}>
      <label className="adjustment intensity"><span>Cường độ bộ lọc</span><input type="range" min="0" max="100" value={edit.intensity} onChange={e => onChange({ ...edit, intensity: +e.target.value })} /><output>{edit.intensity}%</output></label>
      <div className="editor-tools"><button className="soft-button" aria-pressed={before} disabled={!cameraReady && selected === null} onClick={() => onBefore(!before)}><Eye size={14} />{before ? 'Đang xem ảnh gốc' : 'Trước / Sau'}</button><button className="soft-button" onClick={() => { onChange({ ...defaultEdit }); onBefore(false); setGroup('Cơ bản'); }}><RotateCcw size={14} />Khôi phục Original</button><button className="soft-button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><SlidersHorizontal size={14} />Tinh chỉnh</button></div>
      {selected !== null && originalSrc && <div className="selected-edit-preview"><EditedPhoto src={originalSrc} edit={before ? defaultEdit : edit} alt={before ? 'Ảnh gốc trước chỉnh sửa' : 'Ảnh sau chỉnh sửa'} width={500} /><span>{before ? 'Ảnh gốc' : 'Sau chỉnh màu'}</span></div>}
      {advanced && <div className="advanced-controls">
        <div className="adjustment-grid">{(Object.keys(adjustmentLabels) as (keyof Adjustments)[]).map(key => <label className="adjustment" key={key}><span>{adjustmentLabels[key]}</span><input aria-label={adjustmentLabels[key]} type="range" min={key === 'grain' || key === 'vignette' ? 0 : -100} max="100" value={edit[key]} onChange={e => onChange({ ...edit, [key]: +e.target.value })} /><output>{edit[key]}</output></label>)}</div>
        <div className="save-preset"><input maxLength={30} placeholder="Đặt tên công thức màu…" value={name} onChange={e => setName(e.target.value)} aria-label="Tên preset cá nhân" /><button className="soft-button" onClick={savePreset}><Save size={14} />Lưu preset</button></div>
        <div className="personal-presets">{presets.map((p, i) => <span key={p.name}><button onClick={() => { onChange({ ...p.edit }); setGroup(filters.find(f => f.id === p.edit.filterId)!.group); }}>{p.name}</button><button aria-label={`Xóa preset ${p.name}`} onClick={() => deletePreset(i)}><X size={11} /></button></span>)}</div>
        {message && <p role="status" className="small">{message}</p>}
      </div>}
      <button className="apply-all text-button" disabled={!hasPhotos} onClick={onApplyAll}>Áp dụng màu này cho cả bộ ảnh</button>
    </fieldset>
    <p className="editor-footnote">Ảnh gốc + công thức màu = chỉnh bao nhiêu lần cũng không chồng bộ lọc.</p>
  </section>;
}
